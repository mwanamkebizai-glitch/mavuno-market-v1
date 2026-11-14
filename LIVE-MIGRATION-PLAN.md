# Existing Supabase Migration Plan

## Current decision

**Do not run SQL yet.** The current database's schema/migration state must be reconfirmed with read-only queries. The local base schema is not a migration and must not be rerun on the existing project. No production SQL or deployment was performed during this work.

## Before any application

1. Open the existing `mavuno-market` project in Supabase SQL Editor.
2. Run the read-only statements in `LIVE-DATABASE-VERIFICATION.sql`. Confirm that all 21 expected public base tables remain present with RLS enabled, and compare the functions, policies, triggers, and grants with the recorded baseline in `LIVE-DATABASE-REVIEW.md`.
3. If any migration function, trigger, or policy appears partly installed, stop. Do not rerun or attempt an improvised rollback; inspect the exact catalog state first.
4. Confirm the project's recovery/backup availability in the Supabase dashboard. Do not include credentials, keys, or customer data in chat.
5. Test the migration and role-based SQL tests in a disposable local PostgreSQL/Supabase environment first. Use dedicated Farmer, Agri-Vet Supplier, Buyer A/B, and owner-provisioned Admin profiles. The test script is transactional and ends with `ROLLBACK`.
6. Review the exact migration file and its expected verification output. Obtain explicit owner approval.

## If approved by the owner

1. In the existing project's SQL Editor, execute only `supabase/migrations/202611130001_secure_workflows.sql`.
2. Do not execute `supabase/schema.sql`, reset the project, run a broad schema push, or run any destructive SQL.
3. If the editor reports an error, stop and capture the error text with secrets and personal data removed. Do not automatically rerun: inspect the catalog first, since an interrupted multi-statement script may have applied earlier statements.
4. After a successful completion, run the read-only statements in `LIVE-DATABASE-VERIFICATION.sql` again. Confirm the expected workflow functions, trigger protections, final policies, and least-privilege grants.
5. Run `supabase/tests/security_workflows.sql` only against a disposable/test database with configured fixture identities, never against the live production project.
6. Keep the migration unapplied in any automated production pipeline until the owner has reconciled manual SQL Editor application with the chosen migration-history process. Do not fabricate or manually insert a migration-history row.

## Rollback and recovery

This migration changes policies, triggers, functions, and grants. There is no generated automatic rollback script. If post-apply checks fail, pause writes/deployment and use the project's reviewed recovery procedure or a separately reviewed corrective migration. Do not rerun the base schema or issue broad `DROP`/`DELETE` statements as a rollback.
