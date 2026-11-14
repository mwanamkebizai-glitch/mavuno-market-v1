-- Run only against a local or disposable staging Supabase database after the
-- reviewed schema and migration are installed. This test transaction rolls back.
-- Replace the five fixture UUIDs with dedicated users whose profiles have the
-- indicated roles. Do not use production customer accounts.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(43);

select set_config('mavuno.test.seller_a', '00000000-0000-4000-8000-000000000001', true);
select set_config('mavuno.test.seller_b', '00000000-0000-4000-8000-000000000002', true);
select set_config('mavuno.test.buyer_a',  '00000000-0000-4000-8000-000000000003', true);
select set_config('mavuno.test.buyer_b',  '00000000-0000-4000-8000-000000000004', true);
select set_config('mavuno.test.admin',    '00000000-0000-4000-8000-000000000005', true);

do $$
begin
  if not exists (select 1 from public.profiles where id=current_setting('mavuno.test.seller_a')::uuid and role='farmer') then
    raise exception 'Fixture seller_a must be an existing Farmer profile';
  end if;
  if not exists (select 1 from public.profiles where id=current_setting('mavuno.test.seller_b')::uuid and role='supplier') then
    raise exception 'Fixture seller_b must be an existing Agri-Vet Supplier profile';
  end if;
  if not exists (select 1 from public.profiles where id=current_setting('mavuno.test.buyer_a')::uuid and role in ('buyer_individual','buyer_business','buyer_institution')) then
    raise exception 'Fixture buyer_a must be an existing Buyer profile';
  end if;
  if not exists (select 1 from public.profiles where id=current_setting('mavuno.test.buyer_b')::uuid and role in ('buyer_individual','buyer_business','buyer_institution')) then
    raise exception 'Fixture buyer_b must be an existing Buyer profile';
  end if;
  if not exists (select 1 from public.profiles where id=current_setting('mavuno.test.admin')::uuid and role='admin') then
    raise exception 'Fixture admin must be owner-provisioned in this test database';
  end if;
end;
$$;

select set_config('mavuno.test.product_own', gen_random_uuid()::text, true);
select set_config('mavuno.test.product_other', gen_random_uuid()::text, true);
select set_config('mavuno.test.product_paused', gen_random_uuid()::text, true);
select set_config('mavuno.test.product_removed', gen_random_uuid()::text, true);
select set_config('mavuno.test.product_admin', gen_random_uuid()::text, true);
select set_config('mavuno.test.order_paused', gen_random_uuid()::text, true);
select set_config('mavuno.test.order_removed', gen_random_uuid()::text, true);
select set_config('mavuno.test.order_buyer_b', gen_random_uuid()::text, true);
select set_config('mavuno.test.inventory_other_supplier', gen_random_uuid()::text, true);
select set_config('mavuno.test.inventory_supplier_own', gen_random_uuid()::text, true);
select set_config('mavuno.test.verification_submission', gen_random_uuid()::text, true);
select set_config('mavuno.test.refund_record', gen_random_uuid()::text, true);
select set_config('mavuno.test.reversal_report', gen_random_uuid()::text, true);

insert into public.products(id,seller_id,name,category,price,quantity,unit,location,status) values
 (current_setting('mavuno.test.product_other')::uuid,current_setting('mavuno.test.seller_b')::uuid,'Other seller listing','test',10,10,'unit','test location','active'),
 (current_setting('mavuno.test.product_paused')::uuid,current_setting('mavuno.test.seller_a')::uuid,'Paused listing','test',10,0,'unit','test location','paused'),
 (current_setting('mavuno.test.product_removed')::uuid,current_setting('mavuno.test.seller_a')::uuid,'Removed listing','test',10,0,'unit','test location','removed'),
 (current_setting('mavuno.test.product_admin')::uuid,current_setting('mavuno.test.seller_a')::uuid,'Admin moderation listing','test',10,10,'unit','test location','active');

insert into public.orders(id,buyer_id,seller_id,product_id,quantity,unit_price,total_amount,status,payment_status,fulfilment_method) values
 (current_setting('mavuno.test.order_paused')::uuid,current_setting('mavuno.test.buyer_a')::uuid,current_setting('mavuno.test.seller_a')::uuid,current_setting('mavuno.test.product_paused')::uuid,1,10,10,'pending','unpaid','collection'),
 (current_setting('mavuno.test.order_removed')::uuid,current_setting('mavuno.test.buyer_a')::uuid,current_setting('mavuno.test.seller_a')::uuid,current_setting('mavuno.test.product_removed')::uuid,1,10,10,'pending','unpaid','collection'),
 (current_setting('mavuno.test.order_buyer_b')::uuid,current_setting('mavuno.test.buyer_b')::uuid,current_setting('mavuno.test.seller_b')::uuid,current_setting('mavuno.test.product_other')::uuid,1,10,10,'pending','unpaid','collection');

insert into public.inventory_items(id,owner_id,name,quantity,unit)
values(current_setting('mavuno.test.inventory_other_supplier')::uuid,current_setting('mavuno.test.seller_a')::uuid,'Supplier A test stock',10,'unit');

insert into public.verification_submissions(id,user_id,document_type,status)
values(current_setting('mavuno.test.verification_submission')::uuid,current_setting('mavuno.test.buyer_a')::uuid,'test document','pending');

-- Seller A: exercise the Data API role and JWT claims, not a mocked authorization helper.
select set_config('request.jwt.claim.sub', current_setting('mavuno.test.seller_a'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('mavuno.test.seller_a'),'role','authenticated')::text, true);
set local role authenticated;
select lives_ok(
  format(
    'insert into public.products(id,seller_id,name,category,price,quantity,unit,location,status) values (%L,%L,%L,%L,10,10,%L,%L,%L)',
    current_setting('mavuno.test.product_own'),
    current_setting('mavuno.test.seller_a'),
    'Seller A listing',
    'test',
    'unit',
    'test location',
    'active'
  ),
  'Farmer can create own listing'
);
select is((select count(*)::integer from public.products where id=current_setting('mavuno.test.product_own')::uuid),1,'Seller-created listing is present');
select is(
  (with changed as (update public.products set name='Seller A edited listing' where id=current_setting('mavuno.test.product_own')::uuid returning 1) select count(*)::integer from changed),
  1,
  'Seller can edit permitted details of own listing'
);
select is(
  (with changed as (update public.products set name='Unauthorized edit' where id=current_setting('mavuno.test.product_other')::uuid returning 1) select count(*)::integer from changed),
  0,
  'Seller cannot edit another seller listing'
);
select throws_ok(
  $$update public.products set status='paused' where id=current_setting('mavuno.test.product_own')::uuid$$,
  '42501',
  null,
  'Seller cannot set moderation status'
);
select throws_ok(
  $$update public.products set status='active' where id=current_setting('mavuno.test.product_paused')::uuid$$,
  '42501',
  null,
  'Seller cannot reactivate administrator-paused listing'
);
select throws_ok(
  $$update public.products set status='active' where id=current_setting('mavuno.test.product_removed')::uuid$$,
  '42501',
  null,
  'Seller cannot restore administrator-removed listing'
);
select throws_ok(
  $$delete from public.products where id=current_setting('mavuno.test.product_own')::uuid$$,
  '42501',
  null,
  'Seller cannot delete listing directly'
);
reset role;

-- Exercise the trigger with seller JWT claims even when the test connection owns
-- the table, so column grants cannot mask the trigger's independent guard.
select throws_ok(
  $$update public.products set status='paused' where id=current_setting('mavuno.test.product_own')::uuid$$,
  'P0001',
  'Product moderation status is administrator controlled',
  'Database trigger rejects seller moderation transition'
);
select throws_ok(
  $$update public.products set status='active' where id=current_setting('mavuno.test.product_paused')::uuid$$,
  'P0001',
  'Product moderation status is administrator controlled',
  'Database trigger rejects seller reactivation of paused listing'
);
select throws_ok(
  $$update public.products set status='active' where id=current_setting('mavuno.test.product_removed')::uuid$$,
  'P0001',
  'Product moderation status is administrator controlled',
  'Database trigger rejects seller restoration of removed listing'
);

-- Seller cancellation remains permitted but must preserve a moderated state.
set local role authenticated;
select lives_ok(
  format('select public.seller_update_order(%L::uuid,%L::public.order_status,null)',current_setting('mavuno.test.order_paused'),'cancelled'),
  'Seller can cancel eligible order for paused product'
);
select is((select status::text from public.products where id=current_setting('mavuno.test.product_paused')::uuid),'paused','Cancellation preserves paused status');
select lives_ok(
  format('select public.seller_update_order(%L::uuid,%L::public.order_status,null)',current_setting('mavuno.test.order_removed'),'cancelled'),
  'Seller can cancel eligible order for removed product'
);
select is((select status::text from public.products where id=current_setting('mavuno.test.product_removed')::uuid),'removed','Cancellation preserves removed status');
reset role;

-- Owner-provisioned administrator moderates through the protected RPC.
select set_config('request.jwt.claim.sub', current_setting('mavuno.test.admin'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('mavuno.test.admin'),'role','authenticated')::text, true);
set local role authenticated;
select lives_ok(
  format('select public.admin_moderate_product(%L::uuid,%L::public.product_status,null)',current_setting('mavuno.test.product_admin'),'paused'),
  'Authorized administrator can pause listing'
);
select is((select status::text from public.products where id=current_setting('mavuno.test.product_admin')::uuid),'paused','Administrator pause is recorded');
select lives_ok(
  format('select public.admin_moderate_product(%L::uuid,%L::public.product_status,null)',current_setting('mavuno.test.product_admin'),'active'),
  'Authorized administrator can restore listing'
);
select is((select status::text from public.products where id=current_setting('mavuno.test.product_admin')::uuid),'active','Administrator restoration is recorded');
reset role;

-- Buyer A checks out at the database price and server-derived seller, even if
-- client JSON includes forged price and seller_id values.
select set_config('request.jwt.claim.sub', current_setting('mavuno.test.buyer_a'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('mavuno.test.buyer_a'),'role','authenticated')::text, true);
set local role authenticated;
select set_config(
  'mavuno.test.checkout_order',
  (select c.order_id::text
   from public.checkout_cart(
     jsonb_build_array(jsonb_build_object(
       'product_id',current_setting('mavuno.test.product_other'),
       'quantity',2,
       'price',0.01,
       'seller_id',current_setting('mavuno.test.buyer_a')
     ))
   ) as c),
  true
);
select is(
  (select total_amount from public.orders where id=current_setting('mavuno.test.checkout_order')::uuid),
  20::numeric,
  'Checkout uses the current database price, not client price'
);
select is(
  (select seller_id from public.orders where id=current_setting('mavuno.test.checkout_order')::uuid),
  current_setting('mavuno.test.seller_b')::uuid,
  'Checkout derives seller from the database listing'
);
select is(
  (select quantity from public.products where id=current_setting('mavuno.test.product_other')::uuid),
  8::numeric,
  'Checkout reserves stock atomically'
);
select lives_ok(
  format(
    'select public.report_direct_payment(%L::uuid,%L,%L,%L::numeric,%L)',
    current_setting('mavuno.test.checkout_order'),
    'cash',
    'test-payment-reference',
    20,
    'test evidence'
  ),
  'Buyer can report off-platform payment evidence'
);
select is(
  (select payment_status::text from public.orders where id=current_setting('mavuno.test.checkout_order')::uuid),
  'reported',
  'Payment report records status without moving funds'
);
select throws_ok(
  format('select public.admin_moderate_product(%L::uuid,%L::public.product_status,null)',current_setting('mavuno.test.product_admin'),'paused'),
  'P0001',
  'Administrator access required',
  'Unauthorized user cannot execute administrator RPC'
);
select throws_ok(
  format('select public.admin_review_verification(%L::uuid,%L,null)',current_setting('mavuno.test.verification_submission'),'approved'),
  'P0001',
  'Administrator access required',
  'Buyer cannot review verification submissions'
);
select is(
  (select count(*)::integer from public.orders where id=current_setting('mavuno.test.order_buyer_b')::uuid),
  0,
  'Buyer cannot access another buyer private order'
);
select throws_ok(
  format('select public.admin_resolve_refund(%L::uuid,%L,null)',current_setting('mavuno.test.refund_record'),'approved'),
  'P0001',
  'Administrator access required',
  'Buyer cannot resolve refund requests'
);
reset role;

-- Seller A is not the order's seller and cannot confirm Buyer A's evidence.
select set_config('request.jwt.claim.sub', current_setting('mavuno.test.seller_a'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('mavuno.test.seller_a'),'role','authenticated')::text, true);
set local role authenticated;
select throws_ok(
  format('select public.confirm_direct_payment(%L::uuid,null)',current_setting('mavuno.test.checkout_order')),
  'P0001',
  'Only the seller can confirm payment',
  'Unrelated seller cannot confirm payment'
);
reset role;

-- Seller B can confirm reported evidence and respond to a buyer reversal report.
select set_config('request.jwt.claim.sub', current_setting('mavuno.test.seller_b'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('mavuno.test.seller_b'),'role','authenticated')::text, true);
set local role authenticated;
select lives_ok(
  format('select public.confirm_direct_payment(%L::uuid,%L)',current_setting('mavuno.test.checkout_order'),'test checked externally'),
  'Listing seller can confirm manually checked payment evidence'
);
select is(
  (select payment_status::text from public.orders where id=current_setting('mavuno.test.checkout_order')::uuid),
  'seller_confirmed',
  'Seller confirmation updates payment status'
);
reset role;

-- Only the buyer may submit refund and reversal evidence.
select set_config('request.jwt.claim.sub', current_setting('mavuno.test.buyer_a'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('mavuno.test.buyer_a'),'role','authenticated')::text, true);
set local role authenticated;
select lives_ok(
  format(
    'select public.request_refund(%L::uuid,%L,%L::numeric)',
    current_setting('mavuno.test.checkout_order'),
    'test refund reason',
    20
  ),
  'Buyer can request a direct-payment refund review'
);
select set_config(
  'mavuno.test.refund_record',
  (select id::text from public.refund_records where order_id=current_setting('mavuno.test.checkout_order')),
  true
);
select is(
  (select status from public.refund_records where id=current_setting('mavuno.test.refund_record')::uuid),
  'requested',
  'Refund request begins in requested state'
);
select lives_ok(
  format('select public.report_payment_reversal(%L::uuid,%L,%L::numeric,%L)',current_setting('mavuno.test.checkout_order'),'test-reversal-reference',20,'test notes'),
  'Buyer can report an off-platform payment reversal'
);
select set_config(
  'mavuno.test.reversal_report',
  (select id::text from public.reversal_reports where order_id=current_setting('mavuno.test.checkout_order')),
  true
);
reset role;

select set_config('request.jwt.claim.sub', current_setting('mavuno.test.seller_b'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('mavuno.test.seller_b'),'role','authenticated')::text, true);
set local role authenticated;
select lives_ok(
  format('select public.respond_payment_reversal(%L::uuid,true,%L)',current_setting('mavuno.test.reversal_report'),'test response'),
  'Listing seller can respond to a reversal report'
);
select is(
  (select payment_status::text from public.orders where id=current_setting('mavuno.test.checkout_order')::uuid),
  'reversed',
  'Seller reversal response updates payment evidence status'
);
select throws_ok(
  format('select public.adjust_inventory(%L::uuid,1,%L,null)',current_setting('mavuno.test.inventory_other_supplier'),'received'),
  'P0001',
  'Inventory item not found',
  'Supplier cannot modify another supplier inventory'
);
select lives_ok(
  format(
    'insert into public.inventory_items(id,owner_id,name,quantity,unit) values (%L::uuid,%L::uuid,%L,10,%L)',
    current_setting('mavuno.test.inventory_supplier_own'),
    current_setting('mavuno.test.seller_b'),
    'Supplier B test stock',
    'unit'
  ),
  'Supplier can create own inventory item'
);
select is(
  public.adjust_inventory(current_setting('mavuno.test.inventory_supplier_own')::uuid,5,'received',null),
  15::numeric,
  'Supplier can adjust own inventory through the protected RPC'
);
reset role;

-- Owner-provisioned administrator resolves refund and verification workflows.
select set_config('request.jwt.claim.sub', current_setting('mavuno.test.admin'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('mavuno.test.admin'),'role','authenticated')::text, true);
set local role authenticated;
select lives_ok(
  format('select public.admin_resolve_refund(%L::uuid,%L,%L)',current_setting('mavuno.test.refund_record'),'approved','test approved'),
  'Administrator can resolve refund request'
);
select is(
  (select status from public.refund_records where id=current_setting('mavuno.test.refund_record')::uuid),
  'approved',
  'Administrator refund resolution is recorded'
);
select lives_ok(
  format('select public.admin_review_verification(%L::uuid,%L,%L)',current_setting('mavuno.test.verification_submission'),'approved','test approved'),
  'Administrator can review verification submission'
);
select is(
  (select status from public.verification_submissions where id=current_setting('mavuno.test.verification_submission')::uuid),
  'approved',
  'Administrator verification decision is recorded'
);
reset role;

select * from finish();
rollback;
