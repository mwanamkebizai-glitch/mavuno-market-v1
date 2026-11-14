# Mavuno Market V1 — verification report

Run date: 14 November 2026

## Priority audit of implemented / partial / missing / broken requirements

### P0 — must fix before production launch

- Direct off-platform payments and manual evidence are required. The order-detail UI was still exposing an M-Pesa option, which violates the product rule that there is no payment gateway and no M-Pesa API. This has been corrected to a generic direct-payment setup: cash / bank transfer / direct transfer / other, and the platform records evidence only.
- Refund requests were being created through a direct insert into `refund_records` from the client, bypassing the protected workflow. A database RPC (`request_refund`) now enforces buyer-only access and auditability.
- The project still cannot be declared production-ready because real Supabase credentials/configuration and role-based live tests are absent.

### P1 — partially implemented and requires live validation

- Role-based account creation and role protections are present in SQL (`profiles`, user_role enum, admin assignment via trusted SQL), but the live Supabase project has not been configured and role-based E2E tests were not executed.
- Checkout and seller state workflows exist in the SQL migration, but they require a real project and database execution to verify PostgreSQL/RLS behavior.
- Inventory, verification, moderation and notification flows are present in SQL, but they remain unverified in a live Supabase project.

### P2 — present in source but not yet fully certified

- Farm records, product listings, carts, order pages, receipts, reports, verification screens, admin moderation and inventory pages are in place.
- Mobile-first layout and manual location entry are applied for farm creation, but the app still needs full role-based browser verification against a real Supabase project.

## Validation executed in this environment

### Completed checks

- Source and SQL inspection: **PASS** — actual app code and SQL were inspected directly; requested handoff/security/testing docs were not present in this checkout.
- `npm test`: **PASS** — 4 tests passed.
- `npm run typecheck`: **PASS**.
- `npm run build`: **PASS** — optimized Next.js production build completed.
- Local browser preview: **PASS** — landing page rendered using placeholder Supabase configuration. This does not validate Supabase-backed workflows.
- Git staging review: **PASS** — `.env.local` is ignored and not staged; only `.env.example` is included.

### Failed or blocked checks

- `npm audit --audit-level=high`: **FAIL** — 4 dependency vulnerabilities reported (2 high, 2 critical), including advisories affecting the locked Next.js version and DOMPurify through jsPDF. The audit suggests a breaking major-version update for remediation.
- `npm audit fix --dry-run`: **BLOCKED** — npm registry audit endpoint returned `ECONNRESET`; no dependency changes were made.
- PostgreSQL migration execution: **NOT RUN** — no connected Supabase project or Supabase CLI is available.
- Supabase live RLS and role-based tests: **NOT RUN** — no real Supabase project has been configured.
- Role-based browser end-to-end tests: **NOT RUN** — there are no configured real accounts or live database.

## Remaining blockers before production launch

- A real Supabase project must be created and configured with the required environment values.
- The SQL must be applied in a disposable Supabase project and verified live.
- Role-based end-to-end tests must pass for farmer, supplier, buyer and admin flows.
- Real checkout, payment evidence, reversal and refund flows must be tested with separate accounts and audited results.
- The reported high/critical dependency vulnerabilities must be resolved and re-audited before production launch.
- No production claim should be made until that live validation is complete.

## Status

This project is not production-ready yet. The local test, typecheck and production build pass, but the dependency audit reports high/critical vulnerabilities and the project still requires a real Supabase environment and live role-based verification before launch.
