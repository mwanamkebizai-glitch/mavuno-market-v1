# Final Deployment Readiness

Status date: 14 November 2026

## Decision

**Not production-ready.** Local source/build checks pass, but the secure-workflows migration has not been applied or run against PostgreSQL, Supabase remains unverified since the previous read-only inspection, Vercel has no imported project, and role-based browser end-to-end testing has not passed.

## Verified and prepared

- Existing GitHub repository: `mwanamkebizai-glitch/mavuno-market-v1`, branch `main`.
- Starting GitHub head verified before this preparation: `0b9867115f53cb5f606457dd52c6adfe9909ac71`.
- The prepared source, tests, and setup documents were pushed and verified in commit `6df6f04b66a9accfc3be35ef8574aa8d9b8b6536`; `origin/main` matched the local head after the push.
- Prepared changes preserve existing project data; `.env.local` is ignored and was not read.
- Seller cancellation preserves administrator-paused/removed product state. Direct seller product UPDATE grants exclude `status`; a trigger independently blocks moderation transitions, and direct seller product deletion is removed.
- Migration policy creation is rerunnable using guarded policy drops. Protected workflow functions have explicit EXECUTE grants; trigger functions are not client-callable.
- Added `supabase/tests/security_workflows.sql` with 43 transactional pgTAP assertions using `authenticated` role/JWT claims and dedicated Farmer, Supplier, Buyer A/B, and owner-provisioned Admin fixtures.
- Added a read-only live catalog verification script and a manual migration plan. README now explicitly warns not to rerun `supabase/schema.sql` on the existing project.
- Vercel setup instructions document the repository import and environment gates. The wizard currently displays `main`, but its Create button is disabled; no project or deployment was created.

## Local verification

| Check | Result |
|---|---|
| `npm ci` | Pass; 140 packages installed. Local `allowScripts` policy warned that `core-js` postinstall was not approved. |
| `npm test` | Pass; 11 tests. |
| `npm run typecheck` | Pass. |
| `npm run build` | Pass. Next.js 16.4.6 reports React 18 support is deprecated for a future Next.js 17 release. |
| `npm audit --audit-level=high` | Pass on retry; 0 vulnerabilities. First attempt failed with registry `ECONNRESET`. |
| `git diff --check` | Pass. |
| PostgreSQL / pgTAP | Not run: `psql` and Supabase CLI are unavailable. |
| Live Supabase SQL/RLS | Not run by design. |
| Browser end-to-end | Not run; no configured browser E2E runner or real Supabase role accounts. |

## Database state and safety

The last recorded read-only check found 21 public base tables, all with RLS enabled, 37 policies, 126 table-grant rows, no expected workflow RPCs, and no `supabase_migrations.schema_migrations` relation. These are historical observations, not a fresh status check. They suggest the migration is absent but cannot rule out partial manual application.

No Supabase SQL was executed in this preparation. Do not run `supabase/schema.sql`, reset the existing database, or automatically rerun the migration. See [LIVE-DATABASE-REVIEW.md](./LIVE-DATABASE-REVIEW.md), [LIVE-MIGRATION-PLAN.md](./LIVE-MIGRATION-PLAN.md), and [LIVE-DATABASE-VERIFICATION.sql](./LIVE-DATABASE-VERIFICATION.sql).

## Required owner steps

1. Re-run the read-only catalog checks in Supabase and stop if any workflow objects are present unexpectedly.
2. Review and test the exact migration and pgTAP suite in a disposable local PostgreSQL/Supabase environment with dedicated identities. Never use the production project for the tests.
3. Confirm recovery/backup availability and review the migration. The owner must explicitly decide whether to apply only `supabase/migrations/202611130001_secure_workflows.sql`; no base schema rerun is needed or appropriate.
4. Privately configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel. Never place service-role credentials in client settings or chat.
5. Complete a Preview import/deployment only after configuration, then verify all role-specific workflows, RLS, manual location, and direct/off-platform payment behavior.
6. Configure Supabase Auth redirect URLs for the confirmed Vercel domain. Production launch requires successful role-based end-to-end testing and owner approval.

No production SQL, production deployment, payment integration, M-Pesa API, or location-tracking behavior was added or performed.
