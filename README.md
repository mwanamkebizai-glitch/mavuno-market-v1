# Mavuno Market V1 — source package

Mavuno Market is a Kenyan agriculture marketplace with Farmer, Agri-Vet Supplier and Buyer accounts. It uses Next.js 16, TypeScript, Supabase Auth/Postgres and Vercel-compatible deployment configuration.

## Important scope and payment rules

- There is **no payment gateway** and no M-Pesa API integration.
- Buyers pay sellers directly using payment methods agreed between them.
- Mavuno Market records payment and reversal references entered by the parties. Seller confirmation is a record of what the seller confirms, not independent verification by the platform.
- The platform does not hold, transfer, reverse or refund funds.
- PDF receipts are transaction records. Download is supported; native share to WhatsApp/other apps depends on the device/browser. Email opens a draft and the user must attach the downloaded PDF.

## Implemented in this package

- Role-based account profile foundations for farmer, supplier and individual/business/institutional buyer.
- Shared active product marketplace and listing management.
- Client cart with multi-seller, multi-product submission.
- **Database-side atomic checkout**: server re-reads product price and stock under row locks, rejects invalid/self-purchases/insufficient stock, creates one seller-specific order per cart line, reserves stock and creates delivery/collection records in the same transaction.
- Validated seller order-state transitions and stock restoration on eligible cancellation.
- Manual payment evidence submission and seller confirmation through database functions.
- Manual payment-reversal evidence and seller response workflows.
- Inventory item creation and stock movement RPC with negative-stock protection and low-stock notification.
- Database-triggered in-app notifications for orders and messages, plus RPC-generated payment, reversal, verification and inventory notifications.
- Administrator verification decisions, listing moderation and refund-request review actions, all checked inside database functions.
- Role/privilege protection on profile updates; restricted direct writes to orders, payment records, delivery records and inventory movements.
- Farm records, messaging, PDF receipt UI, delivery/collection records, verification, reviews and report foundations.
- Source syntax and security-invariant tests in `tests/`.

## Not yet certified or fully implemented

This package is **not certified production-ready**. Local source tests, typecheck, production build and dependency audit have passed, but the Supabase CLI and PostgreSQL test environment are not available here. The secure-workflows migration has **not** been executed against PostgreSQL or the live Supabase project, and no role-based multi-account end-to-end test has been performed.

The current app is a V1 functional foundation, not a finished enterprise product. Some areas remain partial: full farm operations calendars/worker/machinery workflows, multi-warehouse inventory assignment, upload/storage policies and image handling, richer customer/supplier profiles, complete buyer/seller message conversations, live realtime delivery of notifications, advanced report exports, complete dispute and refund lifecycle, accessibility/security audit, rate limiting, operational monitoring and comprehensive role-by-role browser E2E coverage.

## Setup

1. Install Node.js 20.9 or newer and Git.
2. Extract the ZIP and open the folder in VS Code.
3. Run `npm install`.
4. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` privately. A public anon key or supported `sb_publishable_...` key may be used; never use a service-role key in the client.
5. The existing `mavuno-market` database already contains 21 public tables with RLS enabled. **Do not run `supabase/schema.sql` against it**; that file is only for a fresh, empty development database.
6. For the existing database, read [LIVE-DATABASE-REVIEW.md](./LIVE-DATABASE-REVIEW.md) and [LIVE-MIGRATION-PLAN.md](./LIVE-MIGRATION-PLAN.md). The migration has not been applied. After the owner reviews and approves the plan and tests it in a disposable PostgreSQL/Supabase environment, apply only the reviewed `supabase/migrations/202611130001_secure_workflows.sql` once in the existing project's SQL Editor. Do not apply it automatically.
7. Enable email/password authentication. Configure the site URL and redirect URLs for local development and your deployed domain.
8. Run `npm test`, `npm run typecheck`, `npm run build`, then `npm run dev`.
9. Follow [VERCEL-SETUP.md](./VERCEL-SETUP.md) to import the existing GitHub repository. Do not deploy until Vercel environment values are configured privately and a preview is approved.

Never reset the existing database, drop its tables, or rerun the base schema. The migration changes functions, policies, triggers and grants but is not yet live-verified. It contains no data-deletion statement; review the exact SQL and expected post-checks before manual application.

## Provision the first administrator

Public signup cannot create an admin account. Create an account normally, obtain its Supabase Auth user UUID from the dashboard, then run this trusted SQL as the project owner in Supabase SQL Editor:

```sql
update public.profiles set role = 'admin' where id = 'AUTH-USER-UUID';
```

Do not expose a service-role key in browser code or commit it to GitHub.

## Tests and current verification

Run `npm test` for the local source syntax and security-invariant checks. The role/JWT PostgreSQL test suite is in `supabase/tests/security_workflows.sql`; it is designed for a disposable database with dedicated test accounts and is **not yet run**. Neither source checks nor that test file should be described as live verification. Before launch, run the SQL tests against a disposable PostgreSQL/Supabase environment and test with separate farmer, supplier, buyer and owner-provisioned admin accounts, including concurrent checkout, insufficient stock, unauthorized status changes and unauthorized data access.
