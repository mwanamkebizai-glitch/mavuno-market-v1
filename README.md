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

This package is **not certified production-ready**. The current execution environment could not reach the npm registry (`EAI_AGAIN`), so dependencies could not be installed. Consequently `next build` could not run (`next: not found`). No Supabase CLI or PostgreSQL client is available in this environment, and no Supabase project credentials were supplied. The database schema/migration has therefore **not been deployed or executed against PostgreSQL**, and no live multi-account end-to-end test has been performed.

The current app is a V1 functional foundation, not a finished enterprise product. Some areas remain partial: full farm operations calendars/worker/machinery workflows, multi-warehouse inventory assignment, upload/storage policies and image handling, richer customer/supplier profiles, complete buyer/seller message conversations, live realtime delivery of notifications, advanced report exports, complete dispute and refund lifecycle, accessibility/security audit, rate limiting, operational monitoring and comprehensive role-by-role browser E2E coverage.

## Setup

1. Install Node.js 20.9 or newer and Git.
2. Extract the ZIP and open the folder in VS Code.
3. Run `npm install`.
4. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for your Supabase project.
5. In a **new/empty** Supabase project, run `supabase/schema.sql` in the SQL Editor.
6. Then run `supabase/migrations/202611130001_secure_workflows.sql` in the SQL Editor. It applies the secure workflows and explicit least-privilege Data API grants, so automatic table exposure can remain disabled.
7. Enable email/password authentication. Configure the site URL and redirect URLs for local development and your deployed domain.
8. Run `npm test`, `npm run typecheck`, `npm run build`, then `npm run dev`.
9. Push to GitHub and import the repository into Vercel. Add the same public Supabase environment variables in Vercel.

Do not run the base schema twice on the same database: it creates enum types and tables for a fresh project. Apply the migration once after the base schema. The migration revokes direct client writes to protected order, payment, delivery, inventory-movement, refund and reversal records; those changes go through validated database functions.

## Provision the first administrator

Public signup cannot create an admin account. Create an account normally, obtain its Supabase Auth user UUID from the dashboard, then run this trusted SQL as the project owner in Supabase SQL Editor:

```sql
update public.profiles set role = 'admin' where id = 'AUTH-USER-UUID';
```

Do not expose a service-role key in browser code or commit it to GitHub.

## Tests and current verification

Run `npm test` for the local source syntax and database security-invariant checks. These are not a substitute for PostgreSQL execution, Supabase RLS tests, a successful Next.js production build, or browser-based end-to-end tests. Before launch, execute the SQL against a disposable Supabase project and test with separate farmer, supplier, buyer and admin accounts, including concurrent checkout, insufficient stock, unauthorized status changes and unauthorized data access.
