# Live Database Review

## Scope and safety

This is a record of the previously verified, read-only inspection of the existing `mavuno-market` Supabase project. No SQL from the repository was executed against that project during this work. Do not run `supabase/schema.sql` against it.

## Previously observed state

The dashboard/read-only catalog inspection reported:

| Item | Observed state |
|---|---|
| Project region | Frankfurt (`eu-central-1`) |
| Public base tables | 21 |
| Tables with RLS enabled | 21 of 21 |
| Existing policies | 37 |
| Table-grant rows | 126 |
| Workflow RPCs introduced by the local migration | Not found |
| `supabase_migrations.schema_migrations` | `to_regclass` returned `NULL`; no migration ledger was found |

These are historical observations, not a fresh live query in this session. The absence of a migration ledger and workflow RPCs is consistent with the migration not having been applied, but cannot prove that no part of it was manually executed. Re-run the read-only queries in `LIVE-DATABASE-VERIFICATION.sql` in the dashboard before applying any SQL.

## Local migration contents

The only local migration is `supabase/migrations/202611130001_secure_workflows.sql`. It adds protected workflows for:

- Cart checkout, order updates, and inventory adjustment.
- Direct/off-platform payment reporting and confirmation; no gateway or M-Pesa API is added.
- Payment reversal reporting/responding and refund request/resolution.
- Verification review and product moderation.
- Notifications, validation, row-level policies, and explicit least-privilege table/column grants.

The migration does not drop tables, truncate tables, or delete application rows. It does replace policies and triggers and changes grants; those are consequential security changes and still require review and PostgreSQL execution before the migration can be considered verified.

### Functions expected from the migration

The prior live catalog check did not find the following workflow RPCs:

`is_admin`, `checkout_cart`, `seller_update_order`, `report_direct_payment`, `confirm_direct_payment`, `adjust_inventory`, `admin_review_verification`, `admin_moderate_product`, `request_refund`, `admin_resolve_refund`, `report_payment_reversal`, and `respond_payment_reversal`.

The migration also defines trigger/helper functions for profile, product, order, message, review, inventory, and notification handling. The full catalog query in `LIVE-DATABASE-VERIFICATION.sql` checks their existence, SECURITY DEFINER status, fixed `search_path`, and client EXECUTE privileges after a manual apply.

## Security review and changes in this worktree

- Seller cancellation now leaves a product's `paused` or `removed` moderation state unchanged.
- Direct seller `UPDATE` privilege on `products.status` is excluded; sellers can update only explicitly granted listing columns.
- A trigger independently rejects seller attempts to change moderation state, including reactivation of paused or removed listings.
- Product deletion by sellers is removed. Product moderation remains available through the admin-only RPC.
- Security-definer functions use fixed search paths and explicit EXECUTE grants. Trigger functions and the auth-user trigger function are not exposed as callable client RPCs; `is_admin` and intended authenticated RPCs receive only their required execution grants.
- Migration policies are written to be rerunnable with `DROP POLICY IF EXISTS` before creation/replacement.

These are local source-level changes. They have not yet been applied or validated against the live database.

## Migration risk and prerequisites

The migration makes significant authorization and grant changes. Even though it has no row-deletion or table-drop statements, incorrect application could deny valid app operations or expose/lock down rows incorrectly. Before applying:

1. Re-run the read-only checks in `LIVE-DATABASE-VERIFICATION.sql` and compare against the state above.
2. Stop if unexpected workflow objects exist; inspect for partial application rather than blindly rerunning.
3. Validate the migration and `supabase/tests/security_workflows.sql` against a disposable PostgreSQL/Supabase environment with dedicated test accounts.
4. Confirm a current recovery/backup path for the existing project.
5. Have the project owner review and explicitly approve the exact migration.

No live application, migration, production deployment, or use of service-role credentials is authorized by this document.
