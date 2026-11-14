# Mavuno Market V1 Security Audit

Audit date: 14 November 2026

## Executive summary

The initial dependency audit reported 4 vulnerabilities: 2 high and 2 critical. The vulnerable dependency paths were updated without `npm audit fix --force`. The final clean install, JSON audit, high-severity audit, typecheck, test suite and production build all pass.

The source review also found that sellers could override an administrator's paused/removed product status. The RLS policy is now constrained in both the fresh schema and the secure-workflows migration, with a regression test. The SQL has not been run against a live Supabase project, so database enforcement still requires live verification.

This report does not certify the application as fully secure or production-ready. No deployment was made.

## Original dependency findings

The baseline versions below are from the repository's original lockfile. `npm audit` reported 4 vulnerabilities in total (2 high, 2 critical).

| Affected package path | Previous locked versions | Audit finding |
|---|---|---|
| `next` | `next@14.2.35` | Critical Next.js advisories; the audit marked the installed version vulnerable. |
| `next` -> `postcss` | `next@14.2.35` -> `postcss@8.4.31` | High PostCSS advisories; affected range included versions through `8.5.22`. |
| `jspdf` -> `dompurify` | `jspdf@2.5.2` -> `dompurify@2.5.9` | High DOMPurify advisories; affected range included versions through `3.4.16`. jsPDF versions through `4.2.0` brought in the vulnerable DOMPurify dependency. |

The Next.js advisories included denial-of-service, request-smuggling/cache, SSRF and unauthenticated code-execution issues. The DOMPurify advisories included XSS/sanitization bypasses. The PostCSS advisories included XSS and source-map file disclosure issues.

## Fixes applied

- Updated `next` to `16.4.6`. Its published peer range accepts React `^18.2.0` or React 19; the application remains on React and React DOM `18.3.1`.
- Updated `jspdf` to `4.2.1`; its resolved DOMPurify is `3.4.17`.
- Updated Next.js's nested PostCSS to `8.5.23`; the direct PostCSS dependency remains `8.5.33`.
- Migrated Next.js request APIs to async `cookies`, `params` and `searchParams`, and renamed `middleware.ts` to the Next.js 16 `proxy.ts` convention.
- Restricted seller product updates so sellers cannot modify listings whose status is `paused` or `removed`. Applied the same policy in [schema.sql](./supabase/schema.sql) and [202611130001_secure_workflows.sql](./supabase/migrations/202611130001_secure_workflows.sql).
- Added baseline response headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and a `Permissions-Policy` that disables unused camera, microphone and browser geolocation access.
- Added a source regression test for the seller/moderator RLS policy.
- Updated [README.md](./README.md) for Next.js 16 and its Node.js 20.9 minimum.

No Supabase service-role key or private project secret was added. `.env.local` remains ignored by Git.

## Final package versions

| Package | Before | After | Resolution |
|---|---:|---:|---|
| `next` | 14.2.35 | 16.4.6 | Patched stable version; React 18.3.1 is within its peer range. |
| `postcss` nested under Next.js | 8.4.31 | 8.5.23 | Above the audited vulnerable range. |
| direct `postcss` | 8.5.33 | 8.5.33 | Already above the audited vulnerable range. |
| `jspdf` | 2.5.2 | 4.2.1 | Above the audited affected range through 4.2.0. |
| `dompurify` via jsPDF | 2.5.9 | 3.4.17 | Above the audited affected range through 3.4.16. |
| `react` / `react-dom` | 18.3.1 / 18.3.1 | 18.3.1 / 18.3.1 | Kept unchanged; compatible by Next.js 16 peer metadata. |
| `@supabase/ssr` / `@supabase/supabase-js` | 0.5.2 / 2.119.0 | 0.5.2 / 2.119.0 | Kept unchanged; typecheck and production build pass. |

## Security review findings

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| 1 | 🟡 MEDIUM | [schema.sql](./supabase/schema.sql) | 122 | Seller RLS updates previously let a seller reactivate an administrator-paused or removed listing. The seller update policy now excludes those moderation states in the base schema and migration. | 9/10 |

### Hardening checks

- **Authentication/session handling:** Server rendering awaits Next.js cookies. The Next.js proxy refreshes auth through Supabase `getUser()` and applies refreshed cookies. Live cookie refresh behavior remains unverified without Supabase.
- **RLS/admin authorization:** Signup metadata cannot assign the admin role; admin operations use database functions that check admin status. The seller product-update policy is restricted as described above. Live grants, RLS execution and function ownership remain unverified.
- **Environment secrets:** Only the public Supabase URL and anon key are used by the app. `.env.local` is ignored, and no service-role key was found in the reviewed source.
- **Server-side validation:** Checkout and order/payment workflows use database RPCs; checkout re-reads price and stock and applies row locks. This source-level behavior is covered by existing tests but not by live PostgreSQL tests.
- **Security headers:** The production build manifest was checked and contains all four configured headers. A Content Security Policy is not configured; adding one needs a separate compatibility review of Next.js and Supabase resources.
- **File uploads/storage:** No app file-upload flow was found. Storage bucket policies cannot be assessed without a Supabase project.
- **SQL injection/XSS:** No unparameterized dynamic SQL or `dangerouslySetInnerHTML` use was found in the reviewed app paths. User-provided text is rendered through React; receipt PDF output uses jsPDF text APIs.
- **CSRF:** No concrete CSRF issue was identified in the reviewed client-to-Supabase workflows. Authentication/RLS behavior still needs live role-based tests.

## Verification results

| Check | Result |
|---|---|
| `npm ci` | PASS — clean install completed. npm emitted a warning that `core-js`'s postinstall script was not approved by the local `allow-scripts` setting; install, typecheck, tests and build completed. |
| `npm audit --json` | PASS — 0 total, 0 high, 0 critical. |
| `npm audit --audit-level=high` | PASS — 0 vulnerabilities. |
| `npm ls --json --all` | PASS — exit code 0; patched package paths verified. |
| `npm run typecheck` | PASS. |
| `npm test` | PASS — 5 tests. |
| `npm run build` | PASS — Next.js 16 optimized build. Next.js warns that React 18 support is deprecated and will be removed in Next.js 17; React 18 is currently within the peer range. |
| Production build header manifest | PASS — all configured baseline headers are present. |

## Remaining risks and release blockers

- No real Supabase project has been configured; SQL/RLS migrations and role grants have not been executed against PostgreSQL.
- Farmer, Agri-Vet Supplier, Buyer and admin end-to-end flows have not been tested with separate live accounts.
- Storage policies, Auth redirect settings, rate limiting, operational monitoring and deployment environment values remain unverified.
- No Content Security Policy is configured.
- The project must not be described as fully secure or production-ready until live Supabase role-based testing passes. Deployment was intentionally not performed.
