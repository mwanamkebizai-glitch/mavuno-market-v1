# Supabase secure-workflows migration review

Review date: 14 November 2026

## Executive summary

The secure-workflows migration has **not been applied in this review**. Previously collected read-only evidence found the 21 base tables and RLS enabled on all 21, but the expected workflow RPCs were absent. No migration-history table was found. This supports that the migration is unapplied, but the available history is insufficient to prove that it was never partially attempted.

The independent static security review found one medium-severity authorization flaw: a seller could cancel an eligible order and reactivate a listing that an administrator paused or removed after checkout. It also found that the migration's policy creation was not rerun-safe and that the inventory form offered an operation to ineligible roles. All three findings have been addressed locally and have focused source regression tests. None of these changes has been applied to the live project.

Do not apply the migration to the live project until the local fixes are independently reviewed and PostgreSQL/RLS tests pass. Do not rerun `supabase/schema.sql`.

## Findings

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| 1 | 🟡 MEDIUM | [`202611130001_secure_workflows.sql`](./supabase/migrations/202611130001_secure_workflows.sql) | 113–118, 259–262 | Seller cancellation could restore stock and unconditionally set the product status to `active`, undoing an administrator's later pause or removal. **Fixed locally:** cancellation now preserves `paused`/`removed`; not applied live. | 9/10 |
| 2 | 🟡 MEDIUM | [`202611130001_secure_workflows.sql`](./supabase/migrations/202611130001_secure_workflows.sql) | 193–204 | Admin policies were created without `DROP POLICY IF EXISTS`, making reruns fail on duplicate names. **Fixed locally:** every policy creation now has a matching preceding drop and a static regression test. PostgreSQL replay and runner transaction behavior remain unverified. | 9/10 |
| 3 | ⚪ LOW | [`page.tsx`](./app/inventory/page.tsx), [`InventoryManager.tsx`](./components/InventoryManager.tsx), [`202611130001_secure_workflows.sql`](./supabase/migrations/202611130001_secure_workflows.sql) | 20, 36; 4, 9; 382–392 | The inventory form was shown to any signed-in user, while the database trigger only permits Farmer or Agri-Vet Supplier owners. **Fixed locally:** the page checks the profile role and hides controls from other roles; the database trigger remains authoritative. | 9/10 |

No other exploitable vulnerability was identified by the independent static review of the intended workflow protections. This does not certify the live database or replace role-based end-to-end testing.

## Read-only live-state evidence

These observations were collected in the preceding setup session; no live query was run as part of this review:

- The public schema contained 21 base tables, with RLS enabled on all 21.
- The observed 37 policies matched the base-schema policy set.
- Expected secure-workflow RPCs, migration-specific triggers, and migration-specific policies were absent in the checks performed.
- `to_regclass('supabase_migrations.schema_migrations')` returned `NULL`, and the project overview showed no migrations.
- No migration script was executed, and no live rows, tables, policies, or grants were changed.

The absent migration-history table means there is no recorded migration ledger available from those checks. Absence of the expected objects is evidence that the migration is not currently installed; it does not establish whether an earlier attempt was made and rolled back.

## Migration and workflow assessment

- The migration defines protected RPCs for cart checkout, seller order transitions, manual payment reporting/confirmation, inventory adjustments, verification review, product moderation, refunds, and payment reversals.
- Checkout recalculates prices and seller IDs from database product rows under row locks, validates buyer role and stock, and creates orders within the RPC transaction.
- Payment and reversal RPCs record evidence/status. They do not call a payment gateway or M-Pesa API.
- Privileged RPCs use `SECURITY DEFINER` with a fixed `search_path`, and the migration revokes default function execution before granting selected calls to `authenticated`.
- Policy creation statements now have a matching preceding `DROP POLICY IF EXISTS`, and a source regression test checks every policy definition. Replay behavior has not been exercised against PostgreSQL, so full database-level idempotency is not certified.
- The cancellation RPC now preserves an administrator's `paused` or `removed` state while restoring stock; this behavior still requires PostgreSQL/RLS verification.
- The inventory UI now hides add/adjust controls from roles that the database trigger does not permit.

## Validation and limitations

- The current `npm test` suite has eight source/static checks. It asserts SQL text and client call patterns; it does not execute the migration against PostgreSQL.
- After the local fixes, `npm test` passed (8 tests), `npm run typecheck` passed, `npm run build` passed with a React 18 deprecation warning from Next.js 16, and `npm audit --audit-level=high` reported 0 vulnerabilities on retry after `ECONNRESET`.
- No SQL/RLS test files or browser end-to-end tests are configured in the repository, and the Supabase CLI is not installed. No live SQL/RLS authorization or role-based browser tests were run. The local Supabase values remain placeholders, and no verified Vercel deployment is available.
- The independent review was static. It did not verify live grants, current function bodies, migration runner atomicity, or behavior under real role accounts.

## Recommended next steps

1. Review the local fixes and run PostgreSQL/RLS tests against a disposable local or staging project, including cancellation after moderation and replay of the migration.
2. Before any live application, confirm the live state with read-only metadata checks and use a database backup/approved change window. Apply only the reviewed secure-workflows migration to this existing project; never apply the base schema again.
3. After explicit owner approval and application, run read-only checks for expected RPC signatures, RLS policies, and table/function grants. Then perform role-based tests for Farmer, Agri-Vet Supplier, Buyer, and owner-provisioned admin.

No production-readiness claim is warranted until real Supabase configuration and role-based end-to-end tests pass.
