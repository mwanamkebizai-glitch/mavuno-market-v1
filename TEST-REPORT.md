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
- `npm audit --json`: **PASS** — 0 vulnerabilities (0 high, 0 critical).
- `npm audit --audit-level=high`: **PASS** — 0 vulnerabilities.
- `npm ls --json --all`: **PASS** — dependency tree is consistent; patched Next/PostCSS and jsPDF/DOMPurify versions are installed.
- `npm test`: **PASS** — 5 tests passed, including a regression check for administrator listing moderation.
- `npm run typecheck`: **PASS**.
- `npm run build`: **PASS** — optimized Next.js 16 production build completed. Next.js warns that React 18 support is deprecated and will be removed in Next.js 17, although React 18 remains within the current peer range.
- Built response headers: **PASS** — manifest includes `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and a restrictive `Permissions-Policy`.
- Local browser preview: **PASS** — landing page rendered using placeholder Supabase configuration. This does not validate Supabase-backed workflows.
- Git staging review: **PASS** — `.env.local` is ignored and not staged; only `.env.example` is included.

### Remaining checks blocked by missing project setup

- PostgreSQL migration execution: **NOT RUN** — no connected Supabase project or Supabase CLI is available.
- Supabase live RLS and role-based tests: **NOT RUN** — no real Supabase project has been configured.
- Role-based browser end-to-end tests: **NOT RUN** — there are no configured real accounts or live database.

## Remaining blockers before production launch

- A real Supabase project must be created and configured with the required environment values.
- The SQL must be applied in a disposable Supabase project and verified live.
- Role-based end-to-end tests must pass for farmer, supplier, buyer and admin flows.
- Real checkout, payment evidence, reversal and refund flows must be tested with separate accounts and audited results.
- No production claim should be made until that live validation is complete.

## Status

The reported dependency vulnerabilities have been resolved and the local release checks pass. This project is not production-ready yet: the SQL/RLS changes still need validation in a real Supabase project, and role-based end-to-end tests have not been performed.
