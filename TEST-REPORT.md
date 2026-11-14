# Mavuno Market V1 — verification report

Run date: 14 November 2026

## Priority audit of implemented / partial / missing / broken requirements

### P0 — must fix before production launch

- Direct off-platform payments and manual evidence are required. The order-detail UI was still exposing an M-Pesa option, which violates the product rule that there is no payment gateway and no M-Pesa API. This has been corrected to a generic direct-payment setup: cash / bank transfer / direct transfer / other, and the platform records evidence only.
- Refund requests were being created through a direct insert into `refund_records` from the client, bypassing the protected workflow. A database RPC (`request_refund`) now enforces buyer-only access and auditability.
- Sellers could reactivate listings paused or removed by an administrator. The seller update policy now blocks changes to listings in those moderation states, in both the fresh schema and the secure-workflows migration.
- The project still cannot be declared production-ready because real Supabase credentials/configuration and role-based live tests are absent.

### P1 — partially implemented and requires live validation

- Role-based account creation and role protections are present in SQL (`profiles`, user_role enum, admin assignment via trusted SQL), and the live project has its base tables, but protected workflows and role-based E2E tests are not verified.
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

- Supabase project `mavuno-market` exists in Frankfurt and was previously shown as Healthy. A fresh read-only inventory returned **21 public base tables**, matching the application's base schema table count; the database is not empty.
- A read-only security metadata query returned 21 tables, all 21 with RLS enabled, 37 policies, 126 table-grant rows for `anon`/`authenticated`, and no matching protected workflow RPCs. The 37 policies match the base schema policy count; the secure-workflows migration appears absent or incomplete. Per-table grant details have not been verified.
- The Supabase dashboard showed intermittent 404/resource errors and authentication-lock warnings during this session, though the two read-only metadata queries completed successfully.
- Both required local Supabase environment entries still match the placeholders in `.env.example`; their values are intentionally not recorded here.
- GitHub `main` contains the explicit Data API permissions and protected RPC updates. Vercel has not imported the repository, no Vercel project/deployment is verified, and no Vercel environment values are configured.

- PostgreSQL base tables and RLS enablement: **CONFIRMED PRESENT** — 21 public tables and 21 RLS-enabled tables. The secure-workflows migration is **NOT VERIFIED**; expected RPCs were absent.
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

The source tests, typecheck, production build, and npm audit pass; the audit retry reported 0 vulnerabilities. All 21 base tables have RLS enabled, but the secure-workflows RPCs are absent and policy/grant behavior is unverified. This project is not production-ready: Supabase environment values remain placeholders, Vercel is not configured, and role-based end-to-end tests have not been performed.
