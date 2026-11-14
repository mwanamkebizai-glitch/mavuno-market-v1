# Mavuno Market V1 — verification report

Run date: 14 November 2026

## Priority audit of implemented / partial / missing / broken requirements

### P0 — must fix before production launch

- Direct off-platform payments and manual evidence are required. The order-detail UI was still exposing an M-Pesa option, which violates the product rule that there is no payment gateway and no M-Pesa API. This has been corrected to a generic direct-payment setup: cash / bank transfer / direct transfer / other, and the platform records evidence only.
- Refund requests were being created through a direct insert into `refund_records` from the client, bypassing the protected workflow. A database RPC (`request_refund`) now enforces buyer-only access and auditability.
- Sellers could reactivate listings paused or removed by an administrator. The seller update policy now blocks changes to listings in those moderation states, in both the fresh schema and the secure-workflows migration.
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
- `npm ci`: **PASS** — clean install completed from the updated lockfile.
- `npm audit --audit-level=high`: **PASS** — retry succeeded with 0 vulnerabilities after an initial npm registry `ECONNRESET`.
- `npm ls --json --all`: **PASS** — dependency tree is consistent; patched Next/PostCSS and jsPDF/DOMPurify versions are installed.
- `npm test`: **PASS** — 6 tests passed, including regression checks for administrator listing moderation and explicit Data API grants.
- `npm run typecheck`: **PASS**.
- `npm run build`: **PASS** — optimized Next.js 16 production build completed. Next.js warns that React 18 support is deprecated and will be removed in Next.js 17, although React 18 remains within the current peer range.
- `git diff --check`: **PASS** after this report update.
- Built response headers: **PASS** — manifest includes `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and a restrictive `Permissions-Policy`.
- Local browser preview: **PASS** — landing page rendered using placeholder Supabase configuration. This does not validate Supabase-backed workflows.
- Git staging review: **PASS** — `.env.local` is ignored and not staged; only `.env.example` is included.

### Cloud setup status and blocked checks

- Supabase project `mavuno-market` exists in Frankfurt and was previously shown as Healthy. A previous read-only inventory returned zero public base tables.
- The SQL editor did not provide a verifiable result for the schema execution attempt. After refresh, the editor reported that the query snippet no longer existed and opened a blank query. **Whether the base schema or migration has been applied is unverified.** Do not rerun either script until a fresh read-only inventory confirms the current state.
- The Supabase dashboard showed intermittent 404/resource errors and authentication-lock warnings during this session. No post-apply table, RLS, or grant inventory was obtained.
- Both required local Supabase environment entries still match the placeholders in `.env.example`; their values are intentionally not recorded here.
- GitHub `main` contains commit `1bef4d8` (`Add explicit Supabase data permissions`). Vercel has not imported the repository, no Vercel project/deployment is verified, and no Vercel environment values are configured.

- PostgreSQL schema/migration execution: **NOT VERIFIED** — the project exists, but the dashboard did not return a result that proves application.
- Supabase live RLS and role-based tests: **NOT RUN** — the project does not have confirmed schema state or configured application credentials.
- Role-based browser end-to-end tests: **NOT RUN** — there are no configured real accounts or live database.

## Remaining blockers before production launch

- Verify the live schema using a fresh read-only inventory; only apply the base schema if the inventory proves the database is empty, then apply the secure-workflows migration once.
- Configure the required Supabase URL and anon/publishable key privately in local and Vercel settings; never use a service-role key in the client.
- Import the repository into Vercel and configure Supabase Auth site/redirect URLs after the Vercel domain is available.
- Role-based end-to-end tests must pass for farmer, supplier, buyer and admin flows.
- Real checkout, payment evidence, reversal and refund flows must be tested with separate accounts and audited results.
- No production claim should be made until that live validation is complete.

## Status

The source tests, typecheck, production build, and npm audit pass; the audit retry reported 0 vulnerabilities. This project is not production-ready: the live schema state is unverified, Supabase environment values remain placeholders, Vercel is not configured, and role-based end-to-end tests have not been performed.
