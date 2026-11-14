-- MAVUNO MARKET VERSION 1 schema. Run in Supabase SQL Editor on a fresh project.
create extension if not exists pgcrypto;
create type public.user_role as enum ('farmer','supplier','buyer_individual','buyer_business','buyer_institution','admin');
create type public.product_status as enum ('draft','active','paused','sold_out','removed');
create type public.order_status as enum ('pending','accepted','processing','ready_for_collection','dispatched','delivered','completed','cancelled','disputed');
create type public.payment_status as enum ('unpaid','reported','seller_confirmed','disputed','reversal_reported','reversed','refund_requested','refunded');

create table public.profiles(
 id uuid primary key references auth.users(id) on delete cascade,full_name text not null default '',email text,phone text,
 role public.user_role not null default 'buyer_individual',business_name text,business_type text,institution_type text,
 county text,sub_county text,town text,address text,verification_status text not null default 'unverified',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.farms(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id) on delete cascade,
 name text not null,farm_type text,size numeric,size_unit text default 'acres',county text,sub_county text,town text,
 location_text text,latitude numeric,longitude numeric,description text,created_at timestamptz default now()
);
create table public.farm_activities(
 id uuid primary key default gen_random_uuid(),farm_id uuid not null references public.farms(id) on delete cascade,
 owner_id uuid not null references public.profiles(id),activity_type text not null,activity_date date not null,
 description text,cost numeric default 0,notes text,created_at timestamptz default now()
);
create table public.crop_calendars(
 id uuid primary key default gen_random_uuid(),farm_id uuid not null references public.farms(id) on delete cascade,
 owner_id uuid not null references public.profiles(id),crop text not null,variety text,planting_date date,
 expected_harvest_date date,actual_harvest_date date,expected_quantity numeric,quantity_unit text,
 growth_stage text,season text,created_at timestamptz default now()
);
create table public.farm_machinery(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id),farm_id uuid references public.farms(id),
 name text not null,model text,serial_number text,status text default 'available',purchase_date date,last_service_date date,next_service_date date,notes text
);
create table public.farm_workers(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id),farm_id uuid references public.farms(id),
 worker_name text not null,phone text,role text,active boolean default true,created_at timestamptz default now()
);
create table public.products(
 id uuid primary key default gen_random_uuid(),seller_id uuid not null references public.profiles(id) on delete cascade,
 farm_id uuid references public.farms(id) on delete set null,name text not null,description text,category text not null,
 price numeric(14,2) not null check(price>=0),quantity numeric(14,2) not null default 0 check(quantity>=0),
 unit text not null default 'unit',location text not null,county text,sub_county text,town text,
 is_preharvest boolean not null default false,expected_harvest_date date,image_paths text[] default '{}',
 status public.product_status not null default 'draft',created_at timestamptz default now(),updated_at timestamptz default now()
);
create table public.inventory_locations(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id),name text not null,
 location_text text not null,county text,sub_county text,created_at timestamptz default now()
);
create table public.inventory_items(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id),location_id uuid references public.inventory_locations(id),
 name text not null,sku text,quantity numeric not null default 0,unit text not null default 'unit',reorder_level numeric default 0,
 expiry_date date,location_name text,updated_at timestamptz default now()
);
create table public.stock_movements(
 id uuid primary key default gen_random_uuid(),item_id uuid not null references public.inventory_items(id) on delete cascade,
 owner_id uuid not null references public.profiles(id),movement_type text not null,quantity numeric not null,notes text,created_at timestamptz default now()
);
create table public.orders(
 id uuid primary key default gen_random_uuid(),buyer_id uuid not null references public.profiles(id),seller_id uuid not null references public.profiles(id),
 product_id uuid not null references public.products(id),quantity numeric not null check(quantity>0),unit_price numeric not null check(unit_price>=0),
 total_amount numeric not null check(total_amount>=0),status public.order_status default 'pending',payment_status public.payment_status default 'unpaid',
 payment_method text,buyer_note text,seller_note text,fulfilment_method text,delivery_address text,created_at timestamptz default now(),updated_at timestamptz default now()
);
create table public.payment_records(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,
 reported_by uuid not null references public.profiles(id),method text not null,reference text,amount numeric,notes text,
 status text not null default 'reported',seller_response text,created_at timestamptz default now()
);
create table public.reversal_reports(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,
 reported_by uuid not null references public.profiles(id),reversal_reference text not null,amount numeric,buyer_notes text,
 seller_response text,status text not null default 'reported',created_at timestamptz default now()
);
create table public.refund_records(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,
 requested_by uuid not null references public.profiles(id),reason text not null,amount numeric,status text default 'requested',
 resolution_notes text,created_at timestamptz default now()
);
create table public.delivery_records(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,
 buyer_id uuid not null references public.profiles(id),seller_id uuid not null references public.profiles(id),
 method text not null check(method in ('delivery','collection')),address text,collection_point text,
 tracking_reference text,status text not null default 'pending',delivery_notes text,created_at timestamptz default now()
);
create table public.verification_submissions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),document_type text not null,
 reference text,notes text,status text not null default 'pending',reviewed_by uuid references public.profiles(id),
 review_notes text,created_at timestamptz default now()
);
create table public.saved_products(user_id uuid references public.profiles(id) on delete cascade,product_id uuid references public.products(id) on delete cascade,created_at timestamptz default now(),primary key(user_id,product_id));
create table public.messages(id uuid primary key default gen_random_uuid(),sender_id uuid not null references public.profiles(id),recipient_id uuid not null references public.profiles(id),order_id uuid references public.orders(id),body text not null,read_at timestamptz,created_at timestamptz default now());
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,title text not null,body text not null,link text,read_at timestamptz,created_at timestamptz default now());
create table public.reviews(id uuid primary key default gen_random_uuid(),reviewer_id uuid not null references public.profiles(id),reviewee_id uuid not null references public.profiles(id),order_id uuid references public.orders(id),rating int not null check(rating between 1 and 5),comment text,created_at timestamptz default now(),unique(reviewer_id,order_id));
create table public.activities(id uuid primary key default gen_random_uuid(),actor_id uuid references public.profiles(id),action text not null,entity_type text not null,entity_id uuid,metadata jsonb not null default '{}',created_at timestamptz default now());

-- Auth profile bootstrap. Admin must be assigned manually by trusted project owner, never by public signup.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare r public.user_role;
begin
 begin r := (new.raw_user_meta_data->>'role')::public.user_role; exception when others then r := 'buyer_individual'; end;
 if r='admin' then r := 'buyer_individual'; end if;
 insert into public.profiles(id,full_name,email,phone,role) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),new.email,new.raw_user_meta_data->>'phone',r) on conflict(id) do nothing;
 return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Enable RLS everywhere.
do $$ declare t text; begin foreach t in array array['profiles','farms','farm_activities','crop_calendars','farm_machinery','farm_workers','products','inventory_locations','inventory_items','stock_movements','orders','payment_records','reversal_reports','refund_records','delivery_records','verification_submissions','saved_products','messages','notifications','reviews','activities'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;

create policy "profile self read" on public.profiles for select using(auth.uid()=id);
create policy "profile self update" on public.profiles for update using(auth.uid()=id) with check(auth.uid()=id);
create policy "profile self insert" on public.profiles for insert with check(auth.uid()=id);
create policy "farms public read" on public.farms for select using(true);
create policy "farm owner manage" on public.farms for all using(auth.uid()=owner_id) with check(auth.uid()=owner_id);
create policy "farm activities owner" on public.farm_activities for all using(auth.uid()=owner_id) with check(auth.uid()=owner_id);
create policy "crop calendar owner" on public.crop_calendars for all using(auth.uid()=owner_id) with check(auth.uid()=owner_id);
create policy "machinery owner" on public.farm_machinery for all using(auth.uid()=owner_id) with check(auth.uid()=owner_id);
create policy "workers owner" on public.farm_workers for all using(auth.uid()=owner_id) with check(auth.uid()=owner_id);
create policy "active products public" on public.products for select using(status='active' or auth.uid()=seller_id);
create policy "product seller insert" on public.products for insert with check(auth.uid()=seller_id);
create policy "product seller update" on public.products for update using(auth.uid()=seller_id and status not in ('paused','removed')) with check(auth.uid()=seller_id and status not in ('paused','removed'));
create policy "product seller delete" on public.products for delete using(auth.uid()=seller_id);
create policy "inventory locations owner" on public.inventory_locations for all using(auth.uid()=owner_id) with check(auth.uid()=owner_id);
create policy "inventory items owner" on public.inventory_items for all using(auth.uid()=owner_id) with check(auth.uid()=owner_id);
create policy "stock movements owner" on public.stock_movements for all using(auth.uid()=owner_id) with check(auth.uid()=owner_id);
create policy "order parties select" on public.orders for select using(auth.uid()=buyer_id or auth.uid()=seller_id);
create policy "buyer order insert" on public.orders for insert with check(auth.uid()=buyer_id);
create policy "order parties update" on public.orders for update using(auth.uid()=buyer_id or auth.uid()=seller_id) with check(auth.uid()=buyer_id or auth.uid()=seller_id);
create policy "payment parties select" on public.payment_records for select using(exists(select 1 from public.orders o where o.id=order_id and auth.uid() in(o.buyer_id,o.seller_id)));
create policy "payment parties insert" on public.payment_records for insert with check(reported_by=auth.uid() and exists(select 1 from public.orders o where o.id=order_id and auth.uid() in(o.buyer_id,o.seller_id)));
create policy "payment parties update" on public.payment_records for update using(exists(select 1 from public.orders o where o.id=order_id and auth.uid() in(o.buyer_id,o.seller_id)));
create policy "reversal parties read" on public.reversal_reports for select using(exists(select 1 from public.orders o where o.id=order_id and auth.uid() in(o.buyer_id,o.seller_id)));
create policy "buyer reversal insert" on public.reversal_reports for insert with check(reported_by=auth.uid() and exists(select 1 from public.orders o where o.id=order_id and o.buyer_id=auth.uid()));
create policy "reversal parties update" on public.reversal_reports for update using(exists(select 1 from public.orders o where o.id=order_id and auth.uid() in(o.buyer_id,o.seller_id)));
create policy "refund parties read" on public.refund_records for select using(exists(select 1 from public.orders o where o.id=order_id and auth.uid() in(o.buyer_id,o.seller_id)));
create policy "buyer refund insert" on public.refund_records for insert with check(requested_by=auth.uid() and exists(select 1 from public.orders o where o.id=order_id and o.buyer_id=auth.uid()));
create policy "delivery parties" on public.delivery_records for all using(auth.uid() in(buyer_id,seller_id)) with check(auth.uid() in(buyer_id,seller_id));
create policy "verification own read" on public.verification_submissions for select using(auth.uid()=user_id);
create policy "verification own insert" on public.verification_submissions for insert with check(auth.uid()=user_id);
create policy "saved products own" on public.saved_products for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "messages participants read" on public.messages for select using(auth.uid() in(sender_id,recipient_id));
create policy "message sender insert" on public.messages for insert with check(auth.uid()=sender_id);
create policy "notifications own" on public.notifications for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "reviews public read" on public.reviews for select using(true);
create policy "reviewer insert" on public.reviews for insert with check(auth.uid()=reviewer_id);
create policy "activity actor read" on public.activities for select using(auth.uid()=actor_id);

-- Create a Storage bucket named product-images in the Supabase dashboard.
-- Storage policies must be configured before enabling public uploads.
