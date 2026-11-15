# Mavuno Market V1 — verification report

Run date: 15 November 2026

## Priority audit of implemented / partial / missing / broken requirements

| Priority | Requirement | Source status | Live / end-to-end status |
|---|---|---|---|
| P0 | Trustworthy checkout price, seller identity, stock and order creation | Protected `checkout_cart` re-reads listings, locks stock rows, derives seller/price from the database, and creates orders/delivery records transactionally | Workflow RPC absent from prior live catalog check; role/JWT test file added but not executed |
| P0 | Seller/admin order-state authorization | Protected seller RPC validates transitions and cancellation now preserves paused/removed moderation state | Migration not applied; PostgreSQL/RLS behavior unverified |
| P0 | Admin-only moderation and verification | Signup bootstrap downgrades self-requested admin role; admin RPCs check the owner-provisioned profile; product status column is excluded from seller UPDATE grants and guarded by a trigger | Migration not applied; role tests not executed |
| P0 | Direct payment evidence/status; no gateway or M-Pesa API | UI and RPCs record buyer evidence and seller confirmation only; refunds/reversals use RPCs | No real account workflow or external-payment evidence test run |
| P1 | Farmer, Agri-Vet Supplier, Buyer roles and inventory ownership | Schema roles, RPC role checks, inventory ownership RLS and triggers are present | Live role behavior not verified |
| P1 | User-confirmed/manual location with no location tracking | Location forms use manual text entry; no browser geolocation API or location-tracking call was found in the source search | Needs browser verification after real configuration |
| P1 | RLS and least-privilege Data API grants | Migration explicitly grants intended reads/writes and routes protected records through RPCs | Migration absent from prior live catalog check; full post-apply verification remains outstanding |
| P1 | Mobile-first UX | Responsive layouts and mobile navigation exist in source | No role-based browser E2E run |
| P1 | Public client configuration only | Browser/server clients use only the public Supabase URL and anon-key environment variables; `.env.local` is ignored | Local values remain placeholders; no Vercel environment values configured |
| P1 | Existing Supabase schema and migration history | A read-only preflight found 21 public base tables, none of the expected workflow RPCs, and no migration ledger; RLS status was not rechecked | Migration remains unapplied; PostgreSQL/RLS tests remain outstanding |
| P1 | Existing Vercel project/import | No project exists in the Mavuno Market team; the import form remains stuck loading | No project, deployment, or environment configuration verified |

### P0 — must fix before production launch

- Direct off-platform payments and manual evidence are required. The order-detail UI was still exposing an M-Pesa option, which violates the product rule that there is no payment gateway and no M-Pesa API. This has been corrected to a generic direct-payment setup: cash / bank transfer / direct transfer / other, and the platform records evidence only.
- Refund requests were being created through a direct insert into `refund_records` from the client, bypassing the protected workflow. A database RPC (`request_refund`) now enforces buyer-only access and auditability.
- Direct seller updates to listings paused or removed by an administrator are blocked by the product update policy. The review found that `seller_update_order` cancellation could still reactivate a paused/removed product; this is now fixed locally by preserving moderated statuses, with a source regression test. The migration has not been applied and the behavior has not been tested against PostgreSQL or live accounts.
- The project still cannot be declared production-ready because real Supabase credentials/configuration and role-based live tests are absent.

### P1 — partially implemented and requires live validation

- Role-based account creation and role protections are present in SQL (`profiles`, user_role enum, admin assignment via trusted SQL), and the live project has its base tables, but protected workflows and role-based E2E tests are not verified.
- Checkout and seller state workflows exist in the SQL migration, but they require a real project and database execution to verify PostgreSQL/RLS behavior.
- Inventory, verification, moderation and notification flows are present in SQL, but they remain unverified in a live Supabase project.

### P2 — present in source but not yet fully certified

- Farm records, product listings, carts, order pages, receipts, reports, verification screens, admin moderation and inventory pages are in place.
- Mobile-first layout and manual location entry are applied for farm creation, but the app still needs full role-based browser verification against a real Supabase project.

## Validation executed in this environment

### Current worktree checks

- `npm ci`: **PASS** — installed 140 packages from the lockfile. npm warned that `core-js`'s postinstall script was not approved by the local `allowScripts` policy; installation and build still completed.
- Dashboard task local tests: **PASS** — `node --test tests/source.test.cjs`, 14 tests passed, including role-specific dashboard/navigation and saved-product checks. PowerShell blocked the `npm` script shim, so the existing Node test runner was run directly.
- Dashboard task TypeScript check: **PASS** — `node node_modules/typescript/bin/tsc --noEmit`.
- Dashboard task production build: **PASS** — `node node_modules/next/dist/bin/next build` completed on Next.js 16.4.6. It warns that React 18 support is deprecated in Next.js 16 and will be removed in Next.js 17.
- Dependency audit: **NOT RERUN for this dashboard task**. The earlier audit recorded 0 vulnerabilities on retry.
- `npm audit --audit-level=high`: **PASS on retry** — first request failed with registry `ECONNRESET`; retry reported 0 vulnerabilities.
- `git diff --check`: **PASS**.
- `.env.local`: **ignored by Git**. Its contents were not read or recorded.

### Not run / not available

- PostgreSQL/pgTAP execution: **NOT RUN** — the `psql` and Supabase CLI are not installed. `supabase/tests/security_workflows.sql` contains 43 planned assertions for dedicated role/JWT fixtures and is a disposable-database test artifact only; its assertions are not live SQL verification.
- Live Supabase SQL/RLS mutation or tests: **NOT RUN** — a read-only catalog preflight was run; no migration or other database changes were made.
- Browser E2E: **NOT RUN** — no browser E2E runner is configured and real Supabase settings/accounts are unavailable.
- Vercel import/deploy: **NOT COMPLETED** — the Mavuno Market dashboard has no projects and its import form remains on "Loading project setup". The Vercel CLI is authenticated to a different team, so no project or deployment was created.
- Initial requested docs `.github/copilot-instructions.md`, `COPILOT_HANDOFF.md`, `SECURITY.md`, and `TESTING_GUIDE.md`: **NOT PRESENT** in this checkout.

### Cloud setup status and blocked checks

- A read-only Supabase catalog preflight on 15 November found **21 public base tables**, none of the 11 expected workflow RPC names, and no `supabase_migrations.schema_migrations` relation. RLS status was not rechecked. This indicates the prepared migration is absent, but is not a substitute for PostgreSQL/RLS tests.
- Supabase environment values remain owner-managed and are not recorded here. Prior inspection found placeholders; this task did not read `.env.local`.
- GitHub `main` was updated and verified at commit `657140ec8d6eaf3da6a33e427eb4e6f845eb04c8`. Vercel has no project or configured environment.
- No database backup was created; backup preparation remains paused at the owner's request.

- PostgreSQL base tables and RLS enablement: **PREVIOUSLY CONFIRMED** — 21 public tables and 21 RLS-enabled tables. The secure-workflows migration is **NOT VERIFIED**; expected RPCs were absent in that prior check.
- Supabase live authorization tests: **NOT RUN** — policies and grants have not been behavior-tested, and application credentials remain placeholders.
- Role-based browser end-to-end tests: **NOT RUN** — no real role-based accounts or configured application environment are available.

## Remaining blockers before production launch

- Do not reapply the base schema: 21 public base tables and RLS enablement are present. Review the secure-workflows migration and confirm before applying it once; then verify the resulting functions, policies, and per-table grants.
- Configure the required Supabase URL and anon/publishable key privately in local and Vercel settings; never use a service-role key in the client.
- Import the repository into Vercel and configure Supabase Auth site/redirect URLs after the Vercel domain is available.
- Role-based end-to-end tests must pass for farmer, supplier, buyer and admin flows.
- Real checkout, payment evidence, reversal and refund flows must be tested with separate accounts and audited results.
- No production claim should be made until that live validation is complete.

## Status

The current source tests (14/14), TypeScript check, production build, and dependency audit pass; the audit found 0 vulnerabilities. The build reports the existing React 18 deprecation warning. The pgTAP test file has not been executed. A read-only live preflight found 21 public tables and no expected workflow RPCs or migration ledger; no database mutation was run. GitHub is updated at `657140ec8d6eaf3da6a33e427eb4e6f845eb04c8`. Vercel deployment remains blocked because project setup is stuck and the CLI is authenticated to another team. This project is **not production-ready**: migration application, PostgreSQL/RLS tests, Vercel setup, and role-based browser end-to-end tests remain outstanding.
