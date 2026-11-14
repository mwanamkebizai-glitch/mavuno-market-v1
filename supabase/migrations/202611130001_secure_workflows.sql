-- Mavuno Market V1 secure workflows. Apply AFTER supabase/schema.sql.
-- All money remains outside the platform. This migration only records evidence.

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;

-- Prevent public profile updates from changing privilege or verification fields.
create or replace function public.protect_profile_privileges() returns trigger
language plpgsql security definer set search_path=public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role then raise exception 'Role changes require administrator approval'; end if;
    if new.verification_status is distinct from old.verification_status then raise exception 'Verification status is administrator controlled'; end if;
  end if;
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges before update on public.profiles
for each row execute function public.protect_profile_privileges();

-- Notifications are created server-side for important events.
create or replace function public.notify_user(p_user uuid,p_title text,p_body text,p_link text default null)
returns void language plpgsql security definer set search_path=public
as $$ begin
  if p_user is not null then insert into public.notifications(user_id,title,body,link) values(p_user,p_title,p_body,p_link); end if;
end; $$;

create or replace function public.on_order_created_notify() returns trigger
language plpgsql security definer set search_path=public
as $$
begin
  perform public.notify_user(new.seller_id,'New order received','A buyer placed an order. Review and respond.', '/orders/'||new.id);
  perform public.notify_user(new.buyer_id,'Order submitted','Your order has been submitted to the seller.', '/orders/'||new.id);
  return new;
end; $$;
drop trigger if exists order_created_notify on public.orders;
create trigger order_created_notify after insert on public.orders for each row execute function public.on_order_created_notify();

create or replace function public.on_message_notify() returns trigger
language plpgsql security definer set search_path=public
as $$ begin
  perform public.notify_user(new.recipient_id,'New message','You have received a new message.', '/messages');
  return new;
end; $$;
drop trigger if exists message_notify on public.messages;
create trigger message_notify after insert on public.messages for each row execute function public.on_message_notify();

-- Atomic checkout: re-reads all prices and stock under row locks; ignores client prices/seller IDs.
-- One order per cart line is used by the existing one-product-per-order schema. The whole call
-- is one transaction: any invalid line rolls back all orders and stock reservations.
create or replace function public.checkout_cart(
  p_items jsonb,
  p_fulfilment_method text default 'collection',
  p_delivery_address text default null,
  p_collection_point text default null,
  p_buyer_note text default null
) returns table(order_id uuid,seller_id uuid,product_id uuid,total_amount numeric)
language plpgsql security definer set search_path=public
as $$
declare
  v_buyer uuid := auth.uid(); v_item jsonb; v_product public.products%rowtype;
  v_qty numeric; v_order uuid; v_total numeric; v_role public.user_role;
begin
  if v_buyer is null then raise exception 'Authentication required'; end if;
  if coalesce(jsonb_typeof(p_items),'') <> 'array' then raise exception 'Cart must be a list of products'; end if;
  if jsonb_array_length(p_items)=0 then raise exception 'Cart is empty'; end if;
  if jsonb_array_length(p_items)>50 then raise exception 'Cart exceeds 50 lines'; end if;
  if p_fulfilment_method is null or p_fulfilment_method not in ('delivery','collection') then raise exception 'Invalid fulfilment method'; end if;
  if p_fulfilment_method='delivery' and coalesce(trim(p_delivery_address),'')='' then raise exception 'Delivery address is required'; end if;
  select role into v_role from public.profiles where id=v_buyer;
  if v_role is null or v_role not in ('buyer_individual','buyer_business','buyer_institution') then raise exception 'Only buyer accounts can checkout'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if coalesce(v_item->>'product_id','')='' then raise exception 'Each cart line needs product_id'; end if;
    begin v_qty := (v_item->>'quantity')::numeric; exception when others then raise exception 'Invalid quantity'; end;
    if v_qty<=0 or v_qty>1000000 then raise exception 'Invalid quantity'; end if;
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid for update;
    if not found or v_product.status<>'active' then raise exception 'A cart product is unavailable'; end if;
    if v_product.seller_id=v_buyer then raise exception 'You cannot buy your own listing'; end if;
    if v_product.quantity < v_qty then raise exception 'Insufficient stock for %',v_product.name; end if;
    if v_product.price<0 then raise exception 'Invalid product price'; end if;
    v_total := round(v_product.price*v_qty,2);
    insert into public.orders(buyer_id,seller_id,product_id,quantity,unit_price,total_amount,status,payment_status,fulfilment_method,delivery_address,buyer_note)
    values(v_buyer,v_product.seller_id,v_product.id,v_qty,v_product.price,v_total,'pending','unpaid',p_fulfilment_method,p_delivery_address,p_buyer_note)
    returning id into v_order;
    update public.products set quantity=quantity-v_qty,status=case when quantity-v_qty<=0 then 'sold_out'::public.product_status else status end,updated_at=now() where id=v_product.id;
    insert into public.delivery_records(order_id,buyer_id,seller_id,method,address,collection_point,status)
    values(v_order,v_buyer,v_product.seller_id,p_fulfilment_method,p_delivery_address,p_collection_point,'pending');
    order_id:=v_order; seller_id:=v_product.seller_id; product_id:=v_product.id; total_amount:=v_total; return next;
  end loop;
end; $$;
revoke all on function public.checkout_cart(jsonb,text,text,text,text) from public;
grant execute on function public.checkout_cart(jsonb,text,text,text,text) to authenticated;

-- Seller-only order transitions. Stock is reserved at checkout; cancellation restores it once.
create or replace function public.seller_update_order(p_order_id uuid,p_status public.order_status,p_note text default null)
returns void language plpgsql security definer set search_path=public
as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if auth.uid() is null or auth.uid()<>o.seller_id then raise exception 'Seller access required'; end if;
  if p_status not in ('accepted','processing','ready_for_collection','dispatched','delivered','completed','cancelled','disputed') then raise exception 'Invalid seller transition'; end if;
  if o.status in ('completed','cancelled','disputed') then raise exception 'Order is already closed'; end if;
  if not ((o.status='pending' and p_status in ('accepted','cancelled','disputed')) or (o.status='accepted' and p_status in ('processing','cancelled','disputed')) or (o.status='processing' and p_status in ('ready_for_collection','dispatched','cancelled','disputed')) or (o.status='ready_for_collection' and p_status in ('completed','cancelled','disputed')) or (o.status='dispatched' and p_status in ('delivered','disputed')) or (o.status='delivered' and p_status in ('completed','disputed'))) then raise exception 'Invalid order status transition'; end if;
  if p_status='cancelled' and o.status not in ('pending','accepted','processing','ready_for_collection') then raise exception 'Order can no longer be cancelled'; end if;
  if p_status='dispatched' and (select fulfilment_method from public.orders where id=p_order_id)<>'delivery' then raise exception 'Collection orders cannot be dispatched'; end if;
  if p_status='ready_for_collection' and o.fulfilment_method<>'collection' then raise exception 'This is not a collection order'; end if;
  if p_status='cancelled' then
    update public.products
    set quantity=quantity+o.quantity,
        status=case when status in ('paused','removed') then status else 'active'::public.product_status end,
        updated_at=now()
    where id=o.product_id;
  end if;
  update public.orders set status=p_status,seller_note=coalesce(p_note,seller_note),updated_at=now() where id=p_order_id;
  update public.delivery_records set status=case when p_status='dispatched' then 'dispatched' when p_status='delivered' then 'delivered' when p_status='ready_for_collection' then 'ready_for_collection' when p_status='completed' then 'completed' when p_status='cancelled' then 'cancelled' else status end where order_id=p_order_id;
  perform public.notify_user(o.buyer_id,'Order updated','Seller updated your order to '||replace(p_status::text,'_',' ')||'.','/orders/'||p_order_id);
end; $$;
revoke all on function public.seller_update_order(uuid,public.order_status,text) from public;
grant execute on function public.seller_update_order(uuid,public.order_status,text) to authenticated;

create or replace function public.report_direct_payment(p_order_id uuid,p_method text,p_reference text,p_amount numeric,p_notes text default null)
returns uuid language plpgsql security definer set search_path=public
as $$ declare o public.orders%rowtype; v_id uuid;
begin
  select * into o from public.orders where id=p_order_id for update;
  if not found or auth.uid()<>o.buyer_id then raise exception 'Only the buyer can report payment'; end if;
  if p_method is null or trim(p_method)='' or p_amount is null or p_amount<=0 then raise exception 'Payment method and valid amount are required'; end if;
  insert into public.payment_records(order_id,reported_by,method,reference,amount,notes,status)
  values(p_order_id,auth.uid(),p_method,nullif(trim(p_reference),''),p_amount,p_notes,'reported') returning id into v_id;
  update public.orders set payment_status='reported',payment_method=p_method,updated_at=now() where id=p_order_id;
  perform public.notify_user(o.seller_id,'Payment reported','Buyer submitted payment evidence. Review and confirm only if received.','/orders/'||p_order_id);
  return v_id;
end; $$;
revoke all on function public.report_direct_payment(uuid,text,text,numeric,text) from public;
grant execute on function public.report_direct_payment(uuid,text,text,numeric,text) to authenticated;

create or replace function public.confirm_direct_payment(p_order_id uuid,p_response text default null)
returns void language plpgsql security definer set search_path=public
as $$ declare o public.orders%rowtype; v_payment uuid;
begin
  select * into o from public.orders where id=p_order_id for update;
  if not found or auth.uid()<>o.seller_id then raise exception 'Only the seller can confirm payment'; end if;
  select id into v_payment from public.payment_records where order_id=p_order_id and status='reported' order by created_at desc limit 1 for update;
  if v_payment is null then raise exception 'No reported payment evidence to confirm'; end if;
  update public.payment_records set status='seller_confirmed',seller_response=p_response where id=v_payment;
  update public.orders set payment_status='seller_confirmed',updated_at=now() where id=p_order_id;
  perform public.notify_user(o.buyer_id,'Payment confirmed','Seller confirmed the payment evidence you submitted.','/orders/'||p_order_id);
end; $$;
revoke all on function public.confirm_direct_payment(uuid,text) from public;
grant execute on function public.confirm_direct_payment(uuid,text) to authenticated;

create or replace function public.adjust_inventory(p_item_id uuid,p_delta numeric,p_movement_type text,p_notes text default null)
returns numeric language plpgsql security definer set search_path=public
as $$ declare i public.inventory_items%rowtype; v_new numeric;
begin
  if auth.uid() is null or p_delta=0 or p_movement_type not in ('received','used','sold','damaged','returned','adjustment') then raise exception 'Invalid stock movement'; end if;
  select * into i from public.inventory_items where id=p_item_id for update;
  if not found or i.owner_id<>auth.uid() then raise exception 'Inventory item not found'; end if;
  v_new:=i.quantity+p_delta;
  if v_new<0 then raise exception 'Stock cannot become negative'; end if;
  if p_movement_type in ('received','returned') and p_delta<0 then raise exception 'This movement type requires a positive quantity'; end if;
  if p_movement_type in ('used','sold','damaged') and p_delta>0 then raise exception 'This movement type requires a negative quantity'; end if;
  update public.inventory_items set quantity=v_new,updated_at=now() where id=p_item_id;
  insert into public.stock_movements(item_id,owner_id,movement_type,quantity,notes) values(p_item_id,auth.uid(),p_movement_type,p_delta,p_notes);
  if v_new<=i.reorder_level then perform public.notify_user(auth.uid(),'Low stock alert',i.name||' has reached its reorder level.','/inventory'); end if;
  return v_new;
end; $$;
revoke all on function public.adjust_inventory(uuid,numeric,text,text) from public;
grant execute on function public.adjust_inventory(uuid,numeric,text,text) to authenticated;

create or replace function public.admin_review_verification(p_submission_id uuid,p_status text,p_notes text default null)
returns void language plpgsql security definer set search_path=public
as $$ declare v_user uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_status not in ('approved','rejected','needs_information') then raise exception 'Invalid review status'; end if;
  update public.verification_submissions set status=p_status,reviewed_by=auth.uid(),review_notes=p_notes where id=p_submission_id returning user_id into v_user;
  if v_user is null then raise exception 'Submission not found'; end if;
  if p_status='approved' then update public.profiles set verification_status='verified' where id=v_user;
  elsif p_status='rejected' then update public.profiles set verification_status='rejected' where id=v_user; end if;
  perform public.notify_user(v_user,'Verification reviewed','Your verification submission status is: '||replace(p_status,'_',' '),'/verification');
end; $$;
revoke all on function public.admin_review_verification(uuid,text,text) from public;
grant execute on function public.admin_review_verification(uuid,text,text) to authenticated;

-- Admin visibility for operational queues.
drop policy if exists "admin profiles read" on public.profiles;
create policy "admin profiles read" on public.profiles for select using(public.is_admin());
drop policy if exists "admin products read" on public.products;
create policy "admin products read" on public.products for select using(public.is_admin());
drop policy if exists "admin orders read" on public.orders;
create policy "admin orders read" on public.orders for select using(public.is_admin());
drop policy if exists "admin verification read" on public.verification_submissions;
create policy "admin verification read" on public.verification_submissions for select using(public.is_admin());
drop policy if exists "admin disputes read" on public.refund_records;
create policy "admin disputes read" on public.refund_records for select using(public.is_admin());
drop policy if exists "admin payment records read" on public.payment_records;
create policy "admin payment records read" on public.payment_records for select using(public.is_admin());

-- Remove unsafe direct state mutation policies. State changes use the validated RPCs above.
drop policy if exists "profile self update" on public.profiles;
drop policy if exists "profile self update safe fields" on public.profiles;
create policy "profile self update safe fields" on public.profiles for update using(auth.uid()=id) with check(auth.uid()=id);
drop policy if exists "order parties update" on public.orders;
drop policy if exists "payment parties update" on public.payment_records;
drop policy if exists "reversal parties update" on public.reversal_reports;
drop policy if exists "delivery parties" on public.delivery_records;
drop policy if exists "delivery parties read" on public.delivery_records;
create policy "delivery parties read" on public.delivery_records for select using(auth.uid() in(buyer_id,seller_id) or public.is_admin());
drop policy if exists "notifications own" on public.notifications;
drop policy if exists "notifications own read" on public.notifications;
create policy "notifications own read" on public.notifications for select using(auth.uid()=user_id);
drop policy if exists "notifications own update" on public.notifications;
create policy "notifications own update" on public.notifications for update using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "stock movements owner" on public.stock_movements;
drop policy if exists "stock movements owner read" on public.stock_movements;
create policy "stock movements owner read" on public.stock_movements for select using(auth.uid()=owner_id);
drop policy if exists "inventory items owner" on public.inventory_items;
drop policy if exists "inventory items owner read" on public.inventory_items;
create policy "inventory items owner read" on public.inventory_items for select using(auth.uid()=owner_id);
drop policy if exists "inventory items owner insert" on public.inventory_items;
create policy "inventory items owner insert" on public.inventory_items for insert with check(auth.uid()=owner_id);

-- Restrict public writes to verification decisions and reviews to eligible completed orders.
drop policy if exists "verification own insert" on public.verification_submissions;
drop policy if exists "verification own insert pending" on public.verification_submissions;
create policy "verification own insert pending" on public.verification_submissions for insert with check(auth.uid()=user_id and status='pending' and reviewed_by is null);
drop policy if exists "reviewer insert" on public.reviews;
drop policy if exists "review completed counterpart" on public.reviews;
create policy "review completed counterpart" on public.reviews for insert with check(
 reviewer_id=auth.uid() and exists(select 1 from public.orders o where o.id=order_id and o.status='completed' and auth.uid()=o.buyer_id and reviewee_id=o.seller_id)
);

-- Ensure new order state cannot be forged through client insert. Checkout RPC owns order creation.
drop policy if exists "buyer order insert" on public.orders;

-- Admin account provisioning is a trusted SQL-editor action only:
-- update public.profiles set role='admin' where id='AUTH-USER-UUID';

-- Additional least-privilege hardening and administrator moderation.
create or replace function public.validate_product_seller_role() returns trigger
language plpgsql security definer set search_path=public
as $$ declare r public.user_role;
begin
  select role into r from public.profiles where id=new.seller_id;
  if r not in ('farmer','supplier') then raise exception 'Only farmers and agri-vet suppliers can publish products'; end if;
  return new;
end; $$;
drop trigger if exists validate_product_seller_role on public.products;
create trigger validate_product_seller_role before insert or update of seller_id on public.products
for each row execute function public.validate_product_seller_role();

drop policy if exists "product seller update" on public.products;
create policy "product seller update" on public.products for update
using(auth.uid()=seller_id and status not in ('paused','removed'))
with check(auth.uid()=seller_id and status not in ('paused','removed'));

drop policy if exists "payment parties insert" on public.payment_records;
-- Payment reports must use report_direct_payment; seller confirmation must use confirm_direct_payment.
revoke insert,update,delete on public.payment_records from authenticated;
revoke insert,update,delete on public.orders from authenticated;
revoke insert,update,delete on public.delivery_records from authenticated;
revoke insert,update,delete on public.stock_movements from authenticated;
revoke update,delete on public.inventory_items from authenticated;
revoke update on public.notifications from authenticated;
grant update(read_at) on public.notifications to authenticated;

create or replace function public.admin_moderate_product(p_product_id uuid,p_status public.product_status,p_note text default null)
returns void language plpgsql security definer set search_path=public
as $$ declare v_seller uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_status not in ('active','paused','removed') then raise exception 'Invalid moderation status'; end if;
  update public.products set status=p_status,updated_at=now() where id=p_product_id returning seller_id into v_seller;
  if v_seller is null then raise exception 'Product not found'; end if;
  perform public.notify_user(v_seller,'Listing reviewed','An administrator changed your listing status to '||p_status::text||coalesce(': '||p_note,''),'/products');
end; $$;
revoke all on function public.admin_moderate_product(uuid,public.product_status,text) from public;
grant execute on function public.admin_moderate_product(uuid,public.product_status,text) to authenticated;

create or replace function public.request_refund(p_order_id uuid,p_reason text,p_amount numeric)
returns uuid language plpgsql security definer set search_path=public
as $$ declare o public.orders%rowtype; v_id uuid;
begin
  select * into o from public.orders where id=p_order_id for update;
  if not found or auth.uid()<>o.buyer_id then raise exception 'Only the buyer can request a refund'; end if;
  if coalesce(trim(p_reason),'')='' or p_amount is null or p_amount<=0 then raise exception 'Reason and valid amount are required'; end if;
  insert into public.refund_records(order_id,requested_by,reason,amount,status)
  values(p_order_id,auth.uid(),trim(p_reason),p_amount,'requested') returning id into v_id;
  update public.orders set payment_status='refund_requested',updated_at=now() where id=p_order_id;
  perform public.notify_user(o.seller_id,'Refund request submitted','Buyer requested a direct-payment refund review for this order.','/orders/'||p_order_id);
  return v_id;
end; $$;
revoke all on function public.request_refund(uuid,text,numeric) from public;
grant execute on function public.request_refund(uuid,text,numeric) to authenticated;

create or replace function public.admin_resolve_refund(p_refund_id uuid,p_status text,p_notes text)
returns void language plpgsql security definer set search_path=public
as $$ declare v_order uuid; v_buyer uuid; v_seller uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_status not in ('approved','rejected','resolved') then raise exception 'Invalid refund resolution'; end if;
  update public.refund_records set status=p_status,resolution_notes=p_notes where id=p_refund_id returning order_id into v_order;
  if v_order is null then raise exception 'Refund request not found'; end if;
  select buyer_id,seller_id into v_buyer,v_seller from public.orders where id=v_order;
  perform public.notify_user(v_buyer,'Refund request reviewed','Administrator recorded refund status: '||p_status,'/orders/'||v_order);
  perform public.notify_user(v_seller,'Refund request reviewed','Administrator recorded refund status: '||p_status,'/orders/'||v_order);
end; $$;
revoke all on function public.admin_resolve_refund(uuid,text,text) from public;
grant execute on function public.admin_resolve_refund(uuid,text,text) to authenticated;

drop policy if exists "admin inventory read" on public.inventory_items;
create policy "admin inventory read" on public.inventory_items for select using(public.is_admin());
drop policy if exists "admin verification update" on public.verification_submissions;
create policy "admin verification update" on public.verification_submissions for update using(public.is_admin()) with check(public.is_admin());

create or replace function public.on_review_notify() returns trigger
language plpgsql security definer set search_path=public
as $$ begin
  perform public.notify_user(new.reviewee_id,'New marketplace review','A customer left a review on your completed order.','/profile');
  return new;
end; $$;
drop trigger if exists review_notify on public.reviews;
create trigger review_notify after insert on public.reviews for each row execute function public.on_review_notify();

revoke all on function public.notify_user(uuid,text,text,text) from public, anon, authenticated;

-- Payment reversal evidence is also recorded manually; no money is moved by the platform.
create or replace function public.report_payment_reversal(p_order_id uuid,p_reference text,p_amount numeric,p_notes text default null)
returns uuid language plpgsql security definer set search_path=public
as $$ declare o public.orders%rowtype; v_id uuid;
begin
  select * into o from public.orders where id=p_order_id for update;
  if not found or auth.uid()<>o.buyer_id then raise exception 'Only the buyer can report a payment reversal'; end if;
  if coalesce(trim(p_reference),'')='' or p_amount is null or p_amount<=0 then raise exception 'A reversal reference and valid amount are required'; end if;
  insert into public.reversal_reports(order_id,reported_by,reversal_reference,amount,buyer_notes,status)
  values(p_order_id,auth.uid(),trim(p_reference),p_amount,p_notes,'reported') returning id into v_id;
  update public.orders set payment_status='reversal_reported',updated_at=now() where id=p_order_id;
  perform public.notify_user(o.seller_id,'Payment reversal reported','Buyer submitted a reversal reference. Please check your own payment records.','/orders/'||p_order_id);
  return v_id;
end; $$;
revoke all on function public.report_payment_reversal(uuid,text,numeric,text) from public;
grant execute on function public.report_payment_reversal(uuid,text,numeric,text) to authenticated;

create or replace function public.respond_payment_reversal(p_report_id uuid,p_confirmed boolean,p_response text)
returns void language plpgsql security definer set search_path=public
as $$ declare r public.reversal_reports%rowtype; o public.orders%rowtype;
begin
  select * into r from public.reversal_reports where id=p_report_id for update;
  if not found then raise exception 'Reversal report not found'; end if;
  select * into o from public.orders where id=r.order_id for update;
  if auth.uid()<>o.seller_id then raise exception 'Only the seller can respond to this reversal'; end if;
  if r.status<>'reported' then raise exception 'This reversal report has already been reviewed'; end if;
  update public.reversal_reports set status=case when p_confirmed then 'seller_confirmed' else 'disputed' end,seller_response=p_response where id=p_report_id;
  update public.orders set payment_status=case when p_confirmed then 'reversed'::public.payment_status else 'disputed'::public.payment_status end,updated_at=now() where id=o.id;
  perform public.notify_user(o.buyer_id,'Reversal report reviewed',case when p_confirmed then 'Seller confirmed the reversal evidence.' else 'Seller disputes the reversal evidence.' end,'/orders/'||o.id);
end; $$;
revoke all on function public.respond_payment_reversal(uuid,boolean,text) from public;
grant execute on function public.respond_payment_reversal(uuid,boolean,text) to authenticated;

-- Tighten remaining write paths so users cannot forge an already-reviewed state.
drop policy if exists "profile self insert" on public.profiles;
drop policy if exists "farms public read" on public.farms;
drop policy if exists "farms owner read" on public.farms;
create policy "farms owner read" on public.farms for select using(auth.uid()=owner_id or public.is_admin());
drop policy if exists "buyer reversal insert" on public.reversal_reports;
drop policy if exists "buyer reversal insert pending" on public.reversal_reports;
create policy "buyer reversal insert pending" on public.reversal_reports for insert with check(reported_by=auth.uid() and status='reported' and seller_response is null and exists(select 1 from public.orders o where o.id=order_id and o.buyer_id=auth.uid()));
revoke insert,update,delete on public.reversal_reports from authenticated;
drop policy if exists "buyer refund insert" on public.refund_records;
drop policy if exists "buyer refund insert pending" on public.refund_records;
create policy "buyer refund insert pending" on public.refund_records for insert with check(requested_by=auth.uid() and status='requested' and resolution_notes is null and exists(select 1 from public.orders o where o.id=order_id and o.buyer_id=auth.uid()));
revoke insert,update,delete on public.refund_records from authenticated;
drop policy if exists "admin verification update" on public.verification_submissions;

create or replace function public.validate_inventory_owner_role() returns trigger
language plpgsql security definer set search_path=public
as $$ declare r public.user_role;
begin
  select role into r from public.profiles where id=new.owner_id;
  if r not in ('farmer','supplier') then raise exception 'Only farmers and suppliers can manage inventory'; end if;
  return new;
end; $$;
drop trigger if exists validate_inventory_owner_role on public.inventory_items;
create trigger validate_inventory_owner_role before insert or update of owner_id on public.inventory_items
for each row execute function public.validate_inventory_owner_role();

-- Helper is read-only; direct notification creation is intentionally private to trusted triggers/RPCs.
revoke all on function public.notify_user(uuid,text,text,text) from public, anon, authenticated;

create or replace function public.validate_farm_and_inventory_links() returns trigger
language plpgsql security definer set search_path=public
as $$ declare v_owner uuid;
begin
  if tg_table_name='products' then
    if new.farm_id is not null then
      select owner_id into v_owner from public.farms where id=new.farm_id;
      if v_owner is distinct from new.seller_id then raise exception 'Product farm must belong to the listing seller'; end if;
    end if;
  elsif tg_table_name='inventory_items' then
    if new.location_id is not null then
      select owner_id into v_owner from public.inventory_locations where id=new.location_id;
      if v_owner is distinct from new.owner_id then raise exception 'Inventory location must belong to the inventory owner'; end if;
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists validate_product_farm_owner on public.products;
create trigger validate_product_farm_owner before insert or update of farm_id,seller_id on public.products
for each row execute function public.validate_farm_and_inventory_links();
drop trigger if exists validate_inventory_location_owner on public.inventory_items;
create trigger validate_inventory_location_owner before insert or update of location_id,owner_id on public.inventory_items
for each row execute function public.validate_farm_and_inventory_links();

-- Explicit Data API permissions for projects with automatic table exposure disabled.
revoke all privileges on table
  public.profiles, public.farms, public.farm_activities, public.crop_calendars,
  public.farm_machinery, public.farm_workers, public.products,
  public.inventory_locations, public.inventory_items, public.stock_movements,
  public.orders, public.payment_records, public.reversal_reports, public.refund_records,
  public.delivery_records, public.verification_submissions, public.saved_products,
  public.messages, public.notifications, public.reviews, public.activities
from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant usage on type public.user_role, public.product_status, public.order_status, public.payment_status to anon, authenticated;

grant select on public.products, public.reviews to anon;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on
  public.farms, public.farm_activities, public.crop_calendars, public.farm_machinery, public.farm_workers,
  public.products, public.inventory_locations
to authenticated;
grant select, insert on public.inventory_items, public.verification_submissions to authenticated;
grant select, insert, update, delete on public.saved_products to authenticated;
grant select, insert on public.messages, public.reviews to authenticated;
grant select on
  public.stock_movements, public.orders, public.payment_records, public.reversal_reports,
  public.refund_records, public.delivery_records, public.activities, public.notifications
to authenticated;
grant update(read_at) on public.notifications to authenticated;
