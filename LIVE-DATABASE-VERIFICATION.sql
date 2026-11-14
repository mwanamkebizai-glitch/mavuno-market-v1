-- READ-ONLY catalog checks for the existing Supabase project.
-- Run before and after a manually approved migration. No application data is selected.

-- 1. Public base tables and RLS.
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;

-- 2. Workflow functions and client execution privileges.
select p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer,
       p.proconfig as function_settings,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = any (array[
    'is_admin',
    'checkout_cart',
    'seller_update_order',
    'report_direct_payment',
    'confirm_direct_payment',
    'adjust_inventory',
    'admin_review_verification',
    'admin_moderate_product',
    'request_refund',
    'admin_resolve_refund',
    'report_payment_reversal',
    'respond_payment_reversal',
    'handle_new_user',
    'protect_profile_privileges',
    'protect_product_moderation_status',
    'validate_product_seller_role',
    'validate_inventory_owner_role',
    'validate_farm_and_inventory_links',
    'notify_user',
    'on_order_created_notify',
    'on_message_notify',
    'on_review_notify'
  ])
order by p.proname, arguments;

-- 3. Policies affecting identity, catalog, orders, and inventory.
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = any (array[
    'profiles', 'products', 'orders', 'payment_records',
    'inventory_items', 'stock_movements', 'verification_submissions',
    'refund_records', 'reversal_reports'
  ])
order by tablename, policyname;

-- 4. Relevant user-created triggers and their enabled state.
select n.nspname as schema_name,
       c.relname as table_name,
       t.tgname as trigger_name,
       t.tgenabled as enabled_state,
       p.proname as function_name
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal
  and t.tgname = any (array[
    'protect_profile_privileges',
    'protect_product_moderation_status',
    'validate_product_seller_role',
    'validate_inventory_owner_role',
    'validate_product_farm_owner',
    'validate_inventory_location_owner',
    'order_created_notify',
    'message_notify',
    'review_notify',
    'on_auth_user_created'
  ])
order by n.nspname, c.relname, t.tgname;

-- 5. Critical table and column privileges. A false result means no privilege.
select
  has_table_privilege('anon', 'public.products', 'SELECT') as anon_can_read_products,
  has_table_privilege('authenticated', 'public.products', 'INSERT') as users_can_insert_products,
  has_column_privilege('authenticated', 'public.products', 'name', 'UPDATE') as users_can_update_product_name,
  has_column_privilege('authenticated', 'public.products', 'status', 'UPDATE') as users_can_update_product_status,
  has_table_privilege('authenticated', 'public.products', 'DELETE') as users_can_delete_products,
  has_table_privilege('authenticated', 'public.orders', 'SELECT') as users_can_select_orders,
  has_table_privilege('authenticated', 'public.orders', 'INSERT') as users_can_insert_orders,
  has_table_privilege('authenticated', 'public.orders', 'UPDATE') as users_can_update_orders,
  has_table_privilege('authenticated', 'public.orders', 'DELETE') as users_can_delete_orders,
  has_table_privilege('authenticated', 'public.inventory_items', 'INSERT') as users_can_insert_inventory,
  has_table_privilege('authenticated', 'public.inventory_items', 'UPDATE') as users_can_update_inventory_directly,
  has_table_privilege('authenticated', 'public.inventory_items', 'DELETE') as users_can_delete_inventory;

-- 6. Column-level product UPDATE grants.
select column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'products'
  and grantee = 'authenticated'
  and privilege_type = 'UPDATE'
order by column_name;

-- 7. A Supabase CLI migration ledger may remain absent after a SQL Editor apply.
select to_regclass('supabase_migrations.schema_migrations') as migration_history_table;
