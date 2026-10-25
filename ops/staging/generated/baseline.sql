-- REVIEWED STAGING BASELINE ONLY. Explicit remote approval required.
-- Preferred deployment: original Supabase CLI migrations, which record history.
-- SQL Editor fallback: verify and repair CLI history afterward as documented.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
select pg_advisory_xact_lock(hashtextextended('ann-traders-staging-baseline',0));
-- Read-only assertions. Baseline migrations change grants/RLS across public tables,
-- so this release requires an empty, dedicated application namespace.
do $ann_preflight$
declare applied bigint;
begin
 if to_regclass('auth.users') is null or to_regclass('storage.buckets') is null
    or to_regprocedure('auth.uid()') is null or to_regprocedure('auth.jwt()') is null
    or not exists(select 1 from pg_namespace where nspname='extensions') then
   raise exception 'Supabase platform prerequisites are missing' using errcode='55000';
 end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname in ('public','private','public_catalog') and c.relkind in ('r','p','v','m','f','S'))
    or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
              where n.nspname in ('public','private','public_catalog')
              and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e'))
    or exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
              where n.nspname in ('public','private','public_catalog') and t.typtype in ('e','d')) then
   raise exception 'Baseline blocked: existing application or unrelated public objects need an incremental migration review' using errcode='55000';
 end if;
 if exists(select 1 from storage.buckets where id='catalog-documents') then
   raise exception 'Baseline blocked: catalog-documents already exists; review its configuration and migration history' using errcode='55000';
 end if;
 if to_regclass('supabase_migrations.schema_migrations') is not null then
   if exists(select 1 from pg_attribute where attrelid='supabase_migrations.schema_migrations'::regclass and attname='version' and not attisdropped) then
     execute 'select count(*) from supabase_migrations.schema_migrations' into applied;
     if applied > 0 then
       raise exception 'Baseline blocked: migration history exists; deploy only reviewed missing migrations' using errcode='55000';
     end if;
   else
     raise exception 'Unexpected migration ledger shape' using errcode='55000';
   end if;
 end if;
end $ann_preflight$;


-- SOURCE 20261024000100_core.sql SHA256 3ab8b9e72b1aca0eae631398cd34f12a0809f6c2c5dd31a1b6bc1bfc6e750afe
-- Fresh local/development schema. No remote application authorized.

create schema if not exists private;
create schema if not exists public_catalog;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists btree_gist with schema extensions;
set local search_path=public,extensions;
create table public.admin_profiles (
  id uuid not null references auth.users(id) on delete restrict,
  full_name varchar(150) not null,
  role varchar(20) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id)
);

create table public.categories (
  id uuid default gen_random_uuid() not null,
  parent_id uuid references public.categories(id) on delete restrict,
  name varchar(150) not null,
  slug varchar(180) not null unique,
  description text,
  image_path text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  requires_composition boolean not null default false,
  primary key (id)
);

create table public.brands (
  id uuid default gen_random_uuid() not null,
  name varchar(150) not null,
  slug varchar(180) not null unique,
  logo_path text,
  description text,
  website_url text,
  country_code CHAR(2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id)
);

create table public.units (
  id uuid default gen_random_uuid() not null,
  name varchar(100) not null,
  code varchar(30) not null unique,
  symbol varchar(20) not null,
  unit_family varchar(40) not null,
  factor_to_base NUMERIC(18,8),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id)
);

create table public.products (
  id uuid default gen_random_uuid() not null,
  primary_category_id uuid references public.categories(id) on delete restrict,
  brand_id uuid references public.brands(id) on delete restrict,
  product_code varchar(80) not null unique,
  name varchar(255) not null,
  slug varchar(280) not null unique,
  product_type varchar(30) not null,
  short_description text,
  description text,
  key_features jsonb,
  country_of_origin CHAR(2),
  is_featured boolean not null default false,
  is_new_arrival boolean not null default false,
  status varchar(20) not null,
  seo_title varchar(255),
  seo_description text,
  sort_order integer not null default 0,
  published_at timestamptz,
  created_by uuid not null references public.admin_profiles(id) on delete restrict,
  updated_by uuid not null references public.admin_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  revision bigint not null default 1,
  search_vector tsvector generated always as (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(product_code,'') || ' ' || coalesce(short_description,''))) stored,
  primary key (id)
);

create table public.product_extra_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, category_id)
);

create table public.product_variants (
  id uuid default gen_random_uuid() not null,
  product_id uuid not null references public.products(id) on delete cascade,
  sku varchar(100) not null unique,
  variant_name varchar(255) not null,
  model_number varchar(150),
  manufacturer_part_number varchar(150),
  base_unit_id uuid not null references public.units(id) on delete restrict,
  minimum_order_qty NUMERIC(18,4),
  minimum_order_unit_id uuid not null references public.units(id) on delete restrict,
  monthly_supply_capacity NUMERIC(18,4),
  capacity_unit_id uuid not null references public.units(id) on delete restrict,
  lead_time_days integer,
  availability_status varchar(30) not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id, product_id),
  primary key (id)
);

create table public.attribute_definitions (
  id uuid default gen_random_uuid() not null,
  name varchar(150) not null,
  code varchar(100) not null unique,
  data_type varchar(20) not null,
  default_unit_id uuid references public.units(id) on delete restrict,
  is_filterable boolean not null default false,
  is_searchable boolean not null default false,
  is_variant_axis boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id)
);

create table public.attribute_options (
  id uuid default gen_random_uuid() not null,
  attribute_id uuid not null references public.attribute_definitions(id) on delete restrict,
  value varchar(150) not null,
  label varchar(150) not null,
  color_hex CHAR(7),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  unique(id, attribute_id),
  unique(attribute_id, value),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id)
);

create table public.category_attributes (
  category_id uuid not null references public.categories(id) on delete restrict,
  attribute_id uuid not null references public.attribute_definitions(id) on delete restrict,
  applies_to varchar(20) not null,
  is_required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (category_id, attribute_id, applies_to)
);

create table public.product_attribute_values (
  id uuid default gen_random_uuid() not null,
  product_id uuid not null references public.products(id) on delete cascade,
  attribute_id uuid not null references public.attribute_definitions(id) on delete restrict,
  option_id uuid references public.attribute_options(id) on delete restrict,
  value_text text,
  value_number NUMERIC(18,4),
  value_boolean boolean,
  unit_id uuid references public.units(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id)
);

create table public.variant_attribute_values (
  id uuid default gen_random_uuid() not null,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  attribute_id uuid not null references public.attribute_definitions(id) on delete restrict,
  option_id uuid references public.attribute_options(id) on delete restrict,
  value_text text,
  value_number NUMERIC(18,4),
  value_boolean boolean,
  unit_id uuid references public.units(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id)
);

create table public.variant_prices (
  id uuid default gen_random_uuid() not null,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  currency_code CHAR(3) not null,
  price_type varchar(20) not null,
  min_price NUMERIC(18,4),
  max_price NUMERIC(18,4),
  price_unit_id uuid not null references public.units(id) on delete restrict,
  trade_term varchar(40) not null default '',
  valid_from timestamptz not null,
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id)
);

create table public.price_tiers (
  id uuid default gen_random_uuid() not null,
  variant_price_id uuid not null references public.variant_prices(id) on delete restrict,
  min_quantity NUMERIC(18,4) not null,
  max_quantity NUMERIC(18,4),
  quantity_unit_id uuid not null references public.units(id) on delete restrict,
  unit_price NUMERIC(18,4) not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id)
);

create table public.variant_packaging (
  id uuid default gen_random_uuid() not null,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  packaging_type varchar(100) not null,
  pack_quantity NUMERIC(18,4) not null,
  pack_unit_id uuid not null references public.units(id) on delete restrict,
  package_description text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id)
);

create table public.product_media (
  id uuid default gen_random_uuid() not null,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  media_type varchar(20) not null,
  storage_path text,
  external_url text,
  alt_text varchar(255),
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  provider text not null default 'cloudflare_images' check(provider='cloudflare_images'),
  provider_asset_id text unique,
  delivery_url text,
  upload_status text not null default 'pending' check(upload_status in ('pending','ready','failed')),
  uploaded_by uuid references public.admin_profiles(id),
  content_type text,
  bytes bigint check(bytes > 0 and bytes <= 10485760),
  width integer check(width > 0),
  height integer check(height > 0),
  updated_at timestamptz not null default now(),
  primary key (id)
);

create table public.product_documents (
  id uuid default gen_random_uuid() not null,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  title varchar(255) not null,
  document_type varchar(50) not null,
  storage_path text not null,
  file_extension varchar(15),
  is_public boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  bucket_id text not null default 'catalog-documents',
  content_type text not null default 'application/pdf',
  bytes bigint check(bytes > 0 and bytes <= 10485760),
  uploaded_by uuid references public.admin_profiles(id),
  unique(id, product_id),
  updated_at timestamptz not null default now(),
  primary key (id)
);

create table public.industries (
  id uuid default gen_random_uuid() not null,
  name varchar(150) not null,
  slug varchar(180) not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id)
);

create table public.product_industries (
  product_id uuid not null references public.products(id) on delete cascade,
  industry_id uuid not null references public.industries(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, industry_id)
);

create table public.applications (
  id uuid default gen_random_uuid() not null,
  name varchar(150) not null,
  slug varchar(180) not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id)
);

create table public.product_applications (
  product_id uuid not null references public.products(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, application_id)
);

create table public.certifications (
  id uuid default gen_random_uuid() not null,
  name varchar(150) not null unique,
  issuing_organization varchar(150),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id)
);

create table public.product_certifications (
  id uuid default gen_random_uuid() not null,
  product_id uuid not null references public.products(id) on delete cascade,
  certification_id uuid not null references public.certifications(id) on delete restrict,
  certificate_number varchar(150),
  valid_until date,
  document_id uuid references public.product_documents(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id)
);

create table public.fibers (
  id uuid default gen_random_uuid() not null,
  name varchar(100) not null,
  code varchar(30) not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id)
);

create table public.variant_fiber_composition (
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  fiber_id uuid not null references public.fibers(id) on delete restrict,
  percentage NUMERIC(5,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (variant_id, fiber_id)
);

create table public.equipment_models (
  id uuid default gen_random_uuid() not null,
  brand_id uuid not null references public.brands(id) on delete restrict,
  model_name varchar(150) not null,
  equipment_type varchar(100),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id)
);

create table public.variant_equipment_compatibility (
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  equipment_model_id uuid not null references public.equipment_models(id) on delete restrict,
  compatibility_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (variant_id, equipment_model_id)
);

create table public.audit_logs (
  id uuid default gen_random_uuid() not null,
  admin_id uuid not null references public.admin_profiles(id) on delete restrict,
  entity_name varchar(100) not null,
  entity_id uuid not null,
  action varchar(20) not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id)
);



-- SOURCE 20261024000200_integrity.sql SHA256 98329d74b6f85007da408eeb25cbef62b07f96af113a37127b77068cac91779e

set local search_path=public,extensions;
alter table public.admin_profiles add check(role in ('super_admin','admin','editor'));
alter table public.products add check(status in ('draft','published','archived')), add check(product_type in ('physical','software','service')), add check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
alter table public.units add check(factor_to_base is null or factor_to_base>0), add check(unit_family in ('mass','length','volume','count','areal_density','other'));
alter table public.categories add check(parent_id is distinct from id);
alter table public.brands add check(website_url is null or website_url ~ '^https://[^[:space:]]+$');
alter table public.product_variants add check(minimum_order_qty is null or minimum_order_qty>0), add check(monthly_supply_capacity is null or monthly_supply_capacity>0), add check(lead_time_days is null or lead_time_days>=0), add check(availability_status in ('in_stock','out_of_stock','made_to_order','pre_order','on_request'));
alter table public.attribute_definitions add check(data_type in ('text','number','boolean','select','multi_select'));
alter table public.category_attributes add check(applies_to in ('product','variant'));
alter table public.product_attribute_values add check(num_nonnulls(option_id,value_text,value_number,value_boolean)=1), add foreign key(option_id,attribute_id) references public.attribute_options(id,attribute_id);
alter table public.variant_attribute_values add check(num_nonnulls(option_id,value_text,value_number,value_boolean)=1), add foreign key(option_id,attribute_id) references public.attribute_options(id,attribute_id);
alter table public.variant_prices add check(currency_code ~ '^[A-Z]{3}$'), add check(valid_until is null or valid_until>valid_from), add check(
 (price_type='on_request' and min_price is null and max_price is null) or
 (price_type='fixed' and min_price>0 and max_price is null) or
 (price_type='range' and min_price>0 and max_price>=min_price)
), add check(price_type in ('fixed','range','on_request'));
alter table public.variant_prices add constraint price_windows_exclusive exclude using gist (variant_id with =, currency_code with =, price_unit_id with =, trade_term with =, tstzrange(valid_from,valid_until,'[)') with &&) where(is_active);
alter table public.price_tiers add check(min_quantity>0), add check(max_quantity is null or max_quantity>min_quantity), add check(unit_price>0);
alter table public.price_tiers add constraint tier_ranges_exclusive exclude using gist(variant_price_id with =, numrange(min_quantity,max_quantity,'[)') with &&);
alter table public.variant_packaging add check(pack_quantity>0);
alter table public.variant_fiber_composition add check(percentage>=0 and percentage<=100);
alter table public.product_media add check(media_type='image'), add check(delivery_url is null or delivery_url ~ '^https://imagedelivery.net/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+$'), add check(upload_status<>'ready' or (provider_asset_id is not null and delivery_url is not null)), add foreign key(variant_id,product_id) references public.product_variants(id,product_id);
alter table public.product_documents add check(document_type in ('catalogue','TDS','SDS','MSDS','certificate','manual','other')), add foreign key(variant_id,product_id) references public.product_variants(id,product_id);
alter table public.product_certifications add foreign key(document_id,product_id) references public.product_documents(id,product_id);
create unique index products_code_fold on public.products(lower(product_code));
create unique index variants_sku_fold on public.product_variants(lower(sku));
create unique index categories_slug_fold on public.categories(lower(slug));
create unique index brands_slug_fold on public.brands(lower(slug));
create unique index units_code_fold on public.units(lower(code));
create unique index active_default_variant on public.product_variants(product_id) where(is_default and is_active);
create unique index primary_media on public.product_media(product_id) where(is_primary and upload_status='ready');
create unique index default_pack on public.variant_packaging(variant_id) where(is_default);
create index products_status_updated on public.products(status,updated_at desc,id) where(deleted_at is null);
create index products_search on public.products using gin(search_vector);
create index products_name_trgm on public.products using gin(name extensions.gin_trgm_ops);
create index variants_sku_trgm on public.product_variants using gin(sku extensions.gin_trgm_ops);
create index variants_model_trgm on public.product_variants using gin(model_number extensions.gin_trgm_ops);
create index product_attributes_filter on public.product_attribute_values(attribute_id,value_number,product_id);
create index variant_attributes_filter on public.variant_attribute_values(attribute_id,value_number,variant_id);
create index audit_entity_time on public.audit_logs(entity_name,entity_id,created_at desc);
create index audit_actor_time on public.audit_logs(admin_id,created_at desc);
-- Index every referencing FK, including reverse joins, to avoid unindexed delete checks.
do $$ declare r record; begin
 for r in select t.relname as tbl,a.attname as col from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace join pg_attribute a on a.attrelid=t.oid and a.attnum=c.conkey[1] where c.contype='f' and n.nspname='public' loop
 execute format('create index if not exists %I on public.%I(%I)',r.tbl||'_'||r.col||'_fk',r.tbl,r.col);
 end loop;
end $$;
create function private.touch() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end $$;
create function private.category_tree_guard() returns trigger language plpgsql set search_path='' as $$
declare depth integer; cyclic boolean;
begin
 perform pg_advisory_xact_lock(7241862);
 with recursive ancestors as (
 select c.id,c.parent_id,1 as n,array[c.id] as visited from public.categories c where c.id=new.parent_id
 union all select c.id,c.parent_id,a.n+1,a.visited||c.id from public.categories c join ancestors a on c.id=a.parent_id where a.n<9 and not c.id=any(a.visited)
 ) select coalesce(max(n),0),coalesce(bool_or(id=new.id),false) into depth,cyclic from ancestors;
 if cyclic or depth>=8 then raise exception 'Category would create a cycle or exceed depth 8'; end if;
 return new;
end $$;
create trigger category_tree before insert or update of parent_id on public.categories for each row execute function private.category_tree_guard();
create function private.attribute_guard() returns trigger language plpgsql set search_path='' as $$
declare dtype text; duplicate boolean; owner_id uuid;
begin
 select data_type into dtype from public.attribute_definitions where id=new.attribute_id for share;
 if (dtype='text' and new.value_text is null) or (dtype='number' and new.value_number is null) or (dtype='boolean' and new.value_boolean is null) or (dtype in ('select','multi_select') and new.option_id is null) then raise exception 'Attribute % requires % value',new.attribute_id,dtype; end if;
 owner_id=coalesce(to_jsonb(new)->>'product_id',to_jsonb(new)->>'variant_id')::uuid;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||new.attribute_id::text,0));
 execute format('select exists(select 1 from public.%I where %I=$1 and attribute_id=$2 and id<>$3 and ($4<>''multi_select'' or option_id=$5))',tg_table_name,case when tg_table_name='product_attribute_values' then 'product_id' else 'variant_id' end) into duplicate using owner_id,new.attribute_id,new.id,dtype,new.option_id;
 if duplicate then raise exception 'Duplicate value for attribute %',new.attribute_id; end if;
 return new;
end $$;
create trigger product_attribute_type before insert or update on public.product_attribute_values for each row execute function private.attribute_guard();
create trigger variant_attribute_type before insert or update on public.variant_attribute_values for each row execute function private.attribute_guard();


-- SOURCE 20261024000300_security_rpc.sql SHA256 2b7eb4b041bf6a513ccba986676fa955c44e5db88e156169535b53ade833741a

create function private.current_role() returns text language sql stable security definer set search_path='' as $$ select role from public.admin_profiles where id=auth.uid() and is_active $$;
create function private.require_role(allowed text[]) returns void language plpgsql stable security definer set search_path='' as $$ begin if not coalesce(private.current_role()=any(allowed),false) then raise exception 'Access denied' using errcode='42501'; end if; end $$;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;
revoke all on all tables in schema public from anon,authenticated;
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function private.current_role(),private.require_role(text[]) to authenticated;

-- No direct writes to aggregate tables: authenticated guarded RPCs own transactions.
do $$ declare r record; begin
 for r in select tablename from pg_tables where schemaname='public' loop
 execute format('alter table public.%I enable row level security',r.tablename);
 execute format('grant select on public.%I to authenticated',r.tablename);
 if r.tablename='admin_profiles' then
 execute 'create policy admin_read on public.admin_profiles for select to authenticated using (id=auth.uid() or private.current_role()=''super_admin'')';
 elsif r.tablename='audit_logs' then
 execute 'create policy audit_read on public.audit_logs for select to authenticated using(private.current_role() in (''super_admin'',''admin''))';
 else
 execute format('create policy active_admin_read on public.%I for select to authenticated using(private.current_role() is not null)',r.tablename);
 end if;
 end loop;
end $$;
do $$ declare t text; begin
 foreach t in array array['categories','brands','units','attribute_definitions','attribute_options','category_attributes','industries','applications','certifications','fibers','equipment_models'] loop
 execute format('grant insert,update on public.%I to authenticated',t);
 execute format('create policy master_insert on public.%I for insert to authenticated with check(private.current_role() in (''super_admin'',''admin''))',t);
 execute format('create policy master_update on public.%I for update to authenticated using(private.current_role() in (''super_admin'',''admin'')) with check(private.current_role() in (''super_admin'',''admin''))',t);
 end loop;
end $$;
create function private.audit_write() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid=auth.uid(); data jsonb;
begin
 if actor is not null then
 data=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 insert into public.audit_logs(admin_id,entity_name,entity_id,action,old_data,new_data)
 values(actor,tg_table_name,coalesce((data->>'id')::uuid,(data->>'product_id')::uuid,(data->>'variant_id')::uuid),lower(tg_op),case when tg_op<>'INSERT' then to_jsonb(old)-'storage_path' end,case when tg_op<>'DELETE' then to_jsonb(new)-'storage_path' end);
 end if;
 return coalesce(new,old);
end $$;
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='public' and tablename<>'audit_logs' loop
 execute format('create trigger touch_updated before update on public.%I for each row execute function private.touch()',t);
 execute format('create trigger audit_write after insert or update or delete on public.%I for each row execute function private.audit_write()',t);
 end loop;
end $$;

create function private.create_draft(p_name text,p_code text,p_slug text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform private.require_role(array['super_admin','admin','editor']);
 if length(trim(p_name))<2 or length(trim(p_code))<2 then raise exception 'Name and product code are required'; end if;
 insert into public.products(name,product_code,slug,product_type,status,created_by,updated_by) values(trim(p_name),trim(p_code),p_slug,'physical','draft',auth.uid(),auth.uid()) returning id into result;
 return result;
end $$;
create function public.create_product_draft(p_name text,p_code text,p_slug text) returns uuid language sql security invoker set search_path='' as $$ select private.create_draft(p_name,p_code,p_slug) $$;

create function private.save_draft(payload jsonb) returns bigint language plpgsql security definer set search_path='' as $$
declare p public.products; item jsonb; v public.product_variants; pr public.variant_prices; result bigint;
begin
 perform private.require_role(array['super_admin','admin','editor']);
 if octet_length(payload::text)>524288 then raise exception 'Draft is too large'; end if;
 select * into p from public.products where id=(payload->>'id')::uuid for update;
 if p.id is null then raise exception 'Product not found'; end if;
 if p.status<>'draft' or p.deleted_at is not null then raise exception 'Unpublish or restore this product before editing'; end if;
 if p.revision<>(payload->>'revision')::bigint then raise exception 'This product changed. Reload before saving' using errcode='40001'; end if;
 update public.products set name=payload->'product'->>'name',product_code=payload->'product'->>'product_code',slug=payload->'product'->>'slug',primary_category_id=(payload->'product'->>'primary_category_id')::uuid,brand_id=(payload->'product'->>'brand_id')::uuid,product_type=coalesce(payload->'product'->>'product_type','physical'),short_description=payload->'product'->>'short_description',description=payload->'product'->>'description',country_of_origin=payload->'product'->>'country_of_origin',is_featured=coalesce((payload->'product'->>'is_featured')::boolean,false),is_new_arrival=coalesce((payload->'product'->>'is_new_arrival')::boolean,false),seo_title=payload->'product'->>'seo_title',seo_description=payload->'product'->>'seo_description',updated_by=auth.uid(),revision=revision+1 where id=p.id returning revision into result;
 -- Existing variants are never hard deleted: historic prices retain their owner.
 if exists(select 1 from public.product_variants x where x.product_id=p.id and not exists(select 1 from jsonb_array_elements(payload->'variants') a where (a->>'id')::uuid=x.id)) then raise exception 'Deactivate existing variants instead of removing them'; end if;
 update public.product_variants set is_default=false where product_id=p.id;
 for item in select value from jsonb_array_elements(payload->'variants') loop
 v=jsonb_populate_record(null::public.product_variants,item);
 if exists(select 1 from public.product_variants where id=v.id and product_id<>p.id) then raise exception 'Foreign variant'; end if;
 insert into public.product_variants(id,product_id,sku,variant_name,model_number,base_unit_id,minimum_order_qty,minimum_order_unit_id,monthly_supply_capacity,capacity_unit_id,lead_time_days,availability_status,is_default,is_active)
 values(v.id,p.id,v.sku,v.variant_name,v.model_number,v.base_unit_id,v.minimum_order_qty,v.minimum_order_unit_id,v.monthly_supply_capacity,v.capacity_unit_id,v.lead_time_days,v.availability_status,v.is_default,v.is_active)
 on conflict(id) do update set sku=excluded.sku,variant_name=excluded.variant_name,model_number=excluded.model_number,base_unit_id=excluded.base_unit_id,minimum_order_qty=excluded.minimum_order_qty,minimum_order_unit_id=excluded.minimum_order_unit_id,monthly_supply_capacity=excluded.monthly_supply_capacity,capacity_unit_id=excluded.capacity_unit_id,lead_time_days=excluded.lead_time_days,availability_status=excluded.availability_status,is_default=excluded.is_default,is_active=excluded.is_active;
 end loop;
 -- Price history is immutable. Existing rows can only be deactivated; corrections append.
 for item in select value from jsonb_array_elements(payload->'prices') loop
 pr=jsonb_populate_record(null::public.variant_prices,item);
 if not exists(select 1 from public.product_variants where id=pr.variant_id and product_id=p.id) then raise exception 'Foreign price variant'; end if;
 if exists(select 1 from public.variant_prices where id=pr.id) then
 if not exists(select 1 from public.variant_prices where id=pr.id and variant_id=pr.variant_id and currency_code=pr.currency_code and price_type=pr.price_type and min_price is not distinct from pr.min_price and max_price is not distinct from pr.max_price and price_unit_id=pr.price_unit_id and trade_term=pr.trade_term and valid_from=pr.valid_from and valid_until is not distinct from pr.valid_until) then raise exception 'Append a replacement price instead of changing history'; end if;
 update public.variant_prices set is_active=pr.is_active where id=pr.id;
 else
 insert into public.variant_prices(id,variant_id,currency_code,price_type,min_price,max_price,price_unit_id,trade_term,valid_from,valid_until,is_active) values(pr.id,pr.variant_id,pr.currency_code,pr.price_type,pr.min_price,pr.max_price,pr.price_unit_id,pr.trade_term,pr.valid_from,pr.valid_until,pr.is_active);
 end if;
 end loop;
 return result;
end $$;
create function public.save_product_draft(payload jsonb) returns bigint language sql security invoker set search_path='' as $$ select private.save_draft(payload) $$;

create function private.publish_errors(product uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare errors jsonb='[]'; p public.products; v record; r record;
begin
 perform private.require_role(array['super_admin','admin','editor']);
 select * into p from public.products where id=product;
 if p.primary_category_id is null then errors=errors||jsonb_build_array('Basics: choose a primary category'); end if;
 if not exists(select 1 from public.categories where id=p.primary_category_id and is_active) then errors=errors||jsonb_build_array('Basics: category must be active'); end if;
 if not exists(select 1 from public.product_variants where product_id=product and is_active and is_default) then errors=errors||jsonb_build_array('Variants: choose exactly one active default'); end if;
 if not exists(select 1 from public.product_media where product_id=product and is_primary and upload_status='ready') then errors=errors||jsonb_build_array('Images: attach a verified primary image'); end if;
 for v in select * from public.product_variants where product_id=product and is_active loop
 if not exists(select 1 from public.variant_prices where variant_id=v.id and is_active and valid_from<=now() and (valid_until is null or valid_until>now())) then errors=errors||jsonb_build_array(v.sku||': add a current price or Price on request'); end if;
 if exists(select 1 from public.categories where id=p.primary_category_id and requires_composition) and coalesce((select sum(percentage) from public.variant_fiber_composition where variant_id=v.id),0)<>100 then errors=errors||jsonb_build_array(v.sku||': fiber composition must total 100%'); end if;
 end loop;
 for r in select ca.*,a.name from public.category_attributes ca join public.attribute_definitions a on a.id=ca.attribute_id where ca.category_id=p.primary_category_id and ca.is_required loop
 if r.applies_to='product' and not exists(select 1 from public.product_attribute_values where product_id=product and attribute_id=r.attribute_id) then errors=errors||jsonb_build_array('Specifications: required '||r.name); end if;
 if r.applies_to='variant' then
 for v in select * from public.product_variants where product_id=product and is_active loop
 if not exists(select 1 from public.variant_attribute_values where variant_id=v.id and attribute_id=r.attribute_id) then errors=errors||jsonb_build_array(v.sku||': required '||r.name); end if;
 end loop;
 end if;
 end loop;
 return errors;
end $$;
create function public.product_publish_errors(product uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.publish_errors(product) $$;

create table private.outbox_events(id uuid primary key default gen_random_uuid(),entity_id uuid not null,event_type text not null,revision bigint not null,payload jsonb not null default '{}',created_at timestamptz not null default now(),attempts integer not null default 0,available_at timestamptz not null default now(),completed_at timestamptz,unique(entity_id,event_type,revision));
create function private.lifecycle(product uuid,expected_revision bigint,operation text) returns bigint language plpgsql security definer set search_path='' as $$
declare p public.products; errors jsonb; result bigint;
begin
 perform private.require_role(array['super_admin','admin']);
 select * into p from public.products where id=product for update;
 if p.id is null then raise exception 'Product not found'; end if;
 if p.revision<>expected_revision then raise exception 'This product changed. Reload before continuing' using errcode='40001'; end if;
 if operation not in ('publish','unpublish','archive','delete','restore') then raise exception 'Unknown operation'; end if;
 if operation='publish' then
 if p.deleted_at is not null or p.status<>'draft' then raise exception 'Only an undeleted draft can publish'; end if;
 errors=private.publish_errors(product);if jsonb_array_length(errors)>0 then raise exception '%',errors::text using errcode='23514';end if;
 end if;
 update public.products set status=case when operation='publish' then 'published' when operation in ('unpublish','restore') then 'draft' else 'archived' end,deleted_at=case when operation='delete' then now() when operation='restore' then null else deleted_at end,published_at=case when operation='publish' then now() else published_at end,updated_by=auth.uid(),revision=revision+1 where id=product returning revision into result;
 insert into private.outbox_events(entity_id,event_type,revision) values(product,'catalog.'||operation,result);
 return result;
end $$;
create function public.product_lifecycle(product uuid,expected_revision bigint,operation text) returns bigint language sql security invoker set search_path='' as $$ select private.lifecycle(product,expected_revision,operation) $$;

-- Narrow function permissions; new PostgreSQL functions otherwise default to PUBLIC EXECUTE.
revoke execute on all functions in schema public from public,anon;
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function private.current_role(),private.require_role(text[]),private.create_draft(text,text,text),private.save_draft(jsonb),private.publish_errors(uuid),private.lifecycle(uuid,bigint,text) to authenticated;
grant execute on function public.create_product_draft(text,text,text),public.save_product_draft(jsonb),public.product_publish_errors(uuid),public.product_lifecycle(uuid,bigint,text) to authenticated;

-- Owner-evaluated view is intentional: anon has no underlying table grants.
-- The explicit projection and predicate are the only public access path.
create view public_catalog.products with (security_barrier=true) as select p.id,p.name,p.slug,p.product_code,p.short_description,p.description,p.product_type,p.country_of_origin,p.is_featured,p.is_new_arrival,p.seo_title,p.seo_description,p.published_at,p.updated_at,c.name as category_name,c.slug as category_slug,b.name as brand_name,(select m.delivery_url from public.product_media m where m.product_id=p.id and m.is_primary and m.upload_status='ready' limit 1) as image_url from public.products p join public.categories c on c.id=p.primary_category_id left join public.brands b on b.id=p.brand_id where p.status='published' and p.deleted_at is null and c.is_active;
revoke all on schema public_catalog from public;
grant usage on schema public_catalog to anon,authenticated;
grant select on public_catalog.products to anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('catalog-documents','catalog-documents',false,10485760,array['application/pdf']);
-- No browser storage writes or anonymous reads: verified server workflows are required.


-- SOURCE 20261024000400_relations_search.sql SHA256 904b201b11b82db64ddb21bce945d3703637c9e8d1f794e7a05923046d1a05b8

create function private.save_relation(product uuid,expected_revision bigint,relation text,rows jsonb) returns bigint language plpgsql security definer set search_path='' as $$
declare p public.products; columns text; variant_owned boolean=false; result bigint;
begin
 perform private.require_role(array['super_admin','admin','editor']);
 select * into p from public.products where id=product for update;
 if p.id is null or p.status<>'draft' or p.deleted_at is not null then raise exception 'An undeleted draft is required'; end if;
 if p.revision<>expected_revision then raise exception 'Product changed; reload' using errcode='40001'; end if;
 if jsonb_typeof(rows)<>'array' or jsonb_array_length(rows)>500 or octet_length(rows::text)>262144 then raise exception 'Invalid relationship rows'; end if;
 case relation
 when 'product_extra_categories' then columns='product_id,category_id';
 when 'product_industries' then columns='product_id,industry_id';
 when 'product_applications' then columns='product_id,application_id';
 when 'product_certifications' then columns='id,product_id,certification_id,certificate_number,valid_until,document_id';
 when 'product_attribute_values' then columns='id,product_id,attribute_id,option_id,value_text,value_number,value_boolean,unit_id';
 when 'variant_attribute_values' then columns='id,variant_id,attribute_id,option_id,value_text,value_number,value_boolean,unit_id';variant_owned=true;
 when 'variant_packaging' then columns='id,variant_id,packaging_type,pack_quantity,pack_unit_id,package_description,is_default';variant_owned=true;
 when 'variant_fiber_composition' then columns='variant_id,fiber_id,percentage';variant_owned=true;
 when 'variant_equipment_compatibility' then columns='variant_id,equipment_model_id,compatibility_notes';variant_owned=true;
 when 'price_tiers' then columns='id,variant_price_id,min_quantity,max_quantity,quantity_unit_id,unit_price,sort_order';
 else raise exception 'Unsupported relationship';
 end case;
 if variant_owned then
 if exists(select 1 from jsonb_array_elements(rows) r where not exists(select 1 from public.product_variants v where v.id=(r->>'variant_id')::uuid and v.product_id=product)) then raise exception 'Foreign variant';end if;
 execute format('delete from public.%I where variant_id in (select id from public.product_variants where product_id=$1)',relation) using product;
 elsif relation='price_tiers' then
 if exists(select 1 from jsonb_array_elements(rows) r where not exists(select 1 from public.variant_prices pr join public.product_variants v on v.id=pr.variant_id where pr.id=(r->>'variant_price_id')::uuid and v.product_id=product)) then raise exception 'Foreign price';end if;
 execute 'delete from public.price_tiers where variant_price_id in (select pr.id from public.variant_prices pr join public.product_variants v on v.id=pr.variant_id where v.product_id=$1)' using product;
 else
 if exists(select 1 from jsonb_array_elements(rows) r where (r->>'product_id')::uuid is distinct from product) then raise exception 'Foreign product';end if;
 execute format('delete from public.%I where product_id=$1',relation) using product;
 end if;
 -- relation and columns come exclusively from the allowlist above, never client SQL.
 execute format('insert into public.%I(%s) select %s from jsonb_populate_recordset(null::public.%I,$1)',relation,columns,columns,relation) using rows;
 update public.products set revision=revision+1,updated_by=auth.uid() where id=product returning revision into result;
 return result;
end $$;
create function public.save_product_relation(product uuid,expected_revision bigint,relation text,rows jsonb) returns bigint language sql security invoker set search_path='' as $$ select private.save_relation(product,expected_revision,relation,rows) $$;
create function public.list_admin_products(search text default '',state text default '',category uuid default null,brand uuid default null,page integer default 1,page_size integer default 20,sort text default 'updated_at',ascending boolean default false) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 perform private.require_role(array['super_admin','admin','editor']);
 if page<1 or page>10000 or page_size<1 or page_size>100 or length(search)>100 or sort not in ('updated_at','name','product_code') then raise exception 'Invalid list parameters'; end if;
 with filtered as (
 select p.* from public.products p where (case when state='deleted' then p.deleted_at is not null else p.deleted_at is null end)
 and (state in ('','deleted') or p.status=state) and (category is null or p.primary_category_id=category) and (brand is null or p.brand_id=brand)
 and (search='' or p.search_vector @@ websearch_to_tsquery('simple',search) or p.name ilike '%'||search||'%' or p.product_code ilike '%'||search||'%' or exists(select 1 from public.product_variants v where v.product_id=p.id and (v.sku ilike '%'||search||'%' or v.model_number ilike '%'||search||'%')) or exists(select 1 from public.brands b where b.id=p.brand_id and b.name ilike '%'||search||'%'))
 ), slice as (
 select id,name,product_code,status,primary_category_id,brand_id,updated_at,revision,deleted_at,is_featured from filtered
 order by case when ascending and sort='name' then name end asc,case when not ascending and sort='name' then name end desc,case when ascending and sort='product_code' then product_code end asc,case when not ascending and sort='product_code' then product_code end desc,case when ascending and sort='updated_at' then updated_at end asc,case when not ascending and sort='updated_at' then updated_at end desc,id
 limit page_size offset ((page-1)*page_size)
 ) select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(s)) from slice s),'[]'::jsonb),'total',(select count(*) from filtered)) into result;
 return result;
end $$;
revoke execute on function private.save_relation(uuid,bigint,text,jsonb) from public,anon;
revoke execute on function public.save_product_relation(uuid,bigint,text,jsonb),public.list_admin_products(text,text,uuid,uuid,integer,integer,text,boolean) from public,anon;
grant execute on function private.save_relation(uuid,bigint,text,jsonb),public.save_product_relation(uuid,bigint,text,jsonb),public.list_admin_products(text,text,uuid,uuid,integer,integer,text,boolean) to authenticated;


-- SOURCE 20261024000500_media.sql SHA256 f37f623a481afb317003a94e8bd045efa39c82154885c6dd74bc31975c47240b

create function private.integration_actor(actor uuid,product uuid,expected_revision bigint) returns void language plpgsql set search_path='' as $$
declare p public.products;
begin
 if not exists(select 1 from public.admin_profiles where id=actor and is_active and role in ('super_admin','admin','editor')) then raise exception 'Inactive actor' using errcode='42501';end if;
 select * into p from public.products where id=product for update;
 if p.id is null or p.status<>'draft' or p.deleted_at is not null then raise exception 'An undeleted draft is required';end if;
 if p.revision<>expected_revision then raise exception 'Product changed; reload' using errcode='40001';end if;
end $$;
create function public.stage_image(actor uuid,product uuid,expected_revision bigint,asset text,mime text,size_bytes bigint) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform private.integration_actor(actor,product,expected_revision);
 if mime not in ('image/jpeg','image/png','image/webp') or size_bytes<1 or size_bytes>10485760 then raise exception 'Invalid image metadata';end if;
 if (select count(*) from public.product_media where uploaded_by=actor and created_at>now()-interval '1 hour')>=50 then raise exception 'Hourly upload quota reached';end if;
 insert into public.product_media(product_id,media_type,provider_asset_id,uploaded_by,content_type,bytes) values(product,'image',asset,actor,mime,size_bytes) returning id into result;
 return result;
end $$;
create function public.attach_verified_image(actor uuid,product uuid,expected_revision bigint,media uuid,delivery text) returns bigint language plpgsql security definer set search_path='' as $$
declare result bigint;
begin
 perform private.integration_actor(actor,product,expected_revision);
 if not exists(select 1 from public.product_media where id=media and product_id=product and uploaded_by=actor and upload_status='pending') then raise exception 'Upload ownership mismatch';end if;
 update public.product_media set upload_status='ready',delivery_url=delivery,external_url=delivery,is_primary=not exists(select 1 from public.product_media where product_id=product and is_primary) where id=media;
 update public.products set revision=revision+1,updated_by=actor where id=product returning revision into result;
 return result;
end $$;
create function public.attach_verified_document(actor uuid,product uuid,expected_revision bigint,path text,title_text text,kind text,size_bytes bigint,visible boolean) returns bigint language plpgsql security definer set search_path='' as $$
declare result bigint;
begin
 perform private.integration_actor(actor,product,expected_revision);
 if path not like product::text||'/%' or path like '%..%' then raise exception 'Invalid document path';end if;
 insert into public.product_documents(product_id,title,document_type,storage_path,file_extension,is_public,uploaded_by,bytes) values(product,title_text,kind,path,'pdf',visible,actor,size_bytes);
 update public.products set revision=revision+1,updated_by=actor where id=product returning revision into result;
 return result;
end $$;
create function private.media_action(product uuid,expected_revision bigint,media uuid,operation text,alt text) returns bigint language plpgsql security definer set search_path='' as $$
declare m public.product_media;result bigint;
begin
 perform private.require_role(array['super_admin','admin','editor']);perform private.integration_actor(auth.uid(),product,expected_revision);
 select * into m from public.product_media where id=media and product_id=product for update;if m.id is null then raise exception 'Image not found';end if;
 if operation='primary' and m.upload_status='ready' then update public.product_media set is_primary=false where product_id=product;update public.product_media set is_primary=true where id=media;
 elsif operation='alt' then update public.product_media set alt_text=left(alt,255) where id=media;
 elsif operation='detach' then delete from public.product_media where id=media;
 else raise exception 'Invalid media action';end if;
 update public.products set revision=revision+1,updated_by=auth.uid() where id=product returning revision into result;
 if operation='detach' then insert into private.outbox_events(entity_id,event_type,revision,payload) values(product,'image.detach',result,jsonb_build_object('asset_id',m.provider_asset_id));end if;
 return result;
end $$;
create function public.product_media_action(product uuid,expected_revision bigint,media uuid,operation text,alt text default '') returns bigint language sql security invoker set search_path='' as $$select private.media_action(product,expected_revision,media,operation,alt)$$;
revoke execute on function private.integration_actor(uuid,uuid,bigint),private.media_action(uuid,bigint,uuid,text,text) from public,anon,authenticated;
revoke execute on function public.stage_image(uuid,uuid,bigint,text,text,bigint),public.attach_verified_image(uuid,uuid,bigint,uuid,text),public.attach_verified_document(uuid,uuid,bigint,text,text,text,bigint,boolean),public.product_media_action(uuid,bigint,uuid,text,text) from public,anon,authenticated;
grant execute on function public.stage_image(uuid,uuid,bigint,text,text,bigint),public.attach_verified_image(uuid,uuid,bigint,uuid,text),public.attach_verified_document(uuid,uuid,bigint,text,text,text,bigint,boolean) to service_role;
grant execute on function private.media_action(uuid,bigint,uuid,text,text),public.product_media_action(uuid,bigint,uuid,text,text) to authenticated;


-- SOURCE 20261024000600_hardening.sql SHA256 ed9694006b2d44124a2bcbed11b729be3e8699c8c3c79143c12b7a8f8b23c584

-- SQL CHECK treats NULL as unknown/accepted, so required price fields are explicit.
alter table public.variant_prices add constraint required_price_amounts check(
 (price_type='on_request' and min_price is null and max_price is null) or
 (price_type='fixed' and min_price is not null and min_price>0 and max_price is null) or
 (price_type='range' and min_price is not null and max_price is not null and min_price>0 and max_price>=min_price)
);
alter table public.product_attribute_values add check(value_text is null or length(trim(value_text))>0);
alter table public.variant_attribute_values add check(value_text is null or length(trim(value_text))>0);
create unique index attribute_code_fold on public.attribute_definitions(lower(code));
create unique index industries_slug_fold on public.industries(lower(slug));
create unique index applications_slug_fold on public.applications(lower(slug));
create unique index fibers_code_fold on public.fibers(lower(code));
create unique index equipment_brand_model on public.equipment_models(brand_id,lower(model_name));
create unique index certifications_name_fold on public.certifications(lower(name));
create function private.quantity_unit_guard() returns trigger language plpgsql set search_path='' as $$
declare field text;unit_id uuid;
begin
 foreach field in array case tg_table_name when 'product_variants' then array['base_unit_id','minimum_order_unit_id','capacity_unit_id'] when 'variant_prices' then array['price_unit_id'] when 'price_tiers' then array['quantity_unit_id'] else array['pack_unit_id'] end loop
 unit_id=(to_jsonb(new)->>field)::uuid;
 if exists(select 1 from public.units where id=unit_id and (unit_family='areal_density' or not is_active)) then raise exception '% must use an active quantity unit, not GSM',field;end if;
 end loop;return new;
end $$;
do $$declare t text;begin foreach t in array array['product_variants','variant_prices','price_tiers','variant_packaging'] loop execute format('create trigger quantity_unit_guard before insert or update on public.%I for each row execute function private.quantity_unit_guard()',t);end loop;end$$;
create or replace function private.current_role() returns text language sql stable security definer set search_path='' as $$ select role from public.admin_profiles where id=auth.uid() and is_active and (role='editor' or auth.jwt()->>'aal'='aal2') $$;
-- Profile administration is server-mediated. Actor cannot change their own role/state.
create function public.manage_admin(actor uuid,target uuid,display_name text,new_role text,active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if actor=target or not exists(select 1 from public.admin_profiles where id=actor and is_active and role='super_admin') then raise exception 'Role change denied' using errcode='42501';end if;
 if new_role not in ('super_admin','admin','editor') or length(trim(display_name))<2 then raise exception 'Invalid administrator details';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 insert into public.admin_profiles(id,full_name,role,is_active) values(target,display_name,new_role,active) on conflict(id) do update set full_name=excluded.full_name,role=excluded.role,is_active=excluded.is_active;
end $$;
revoke execute on function public.manage_admin(uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.manage_admin(uuid,uuid,text,text,boolean) to service_role;
revoke execute on function private.quantity_unit_guard() from public,anon,authenticated;


-- SOURCE 20261024000700_audit_and_public.sql SHA256 d15f5302c081f8d9f841716703edeefbb2a4782b23b3c2fddfbb62ae5836b725

create or replace function private.audit_write() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid=auth.uid(); data jsonb;
begin
 if actor is not null then
 data=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 insert into public.audit_logs(admin_id,entity_name,entity_id,action,old_data,new_data)
 values(actor,tg_table_name,coalesce((data->>'id')::uuid,(data->>'product_id')::uuid,(data->>'variant_id')::uuid,(data->>'category_id')::uuid),lower(tg_op),case when tg_op<>'INSERT' then to_jsonb(old)-'storage_path' end,case when tg_op<>'DELETE' then to_jsonb(new)-'storage_path' end);
 end if;return coalesce(new,old);
end $$;
create or replace function private.integration_actor(actor uuid,product uuid,expected_revision bigint) returns void language plpgsql set search_path='' as $$
declare p public.products;
begin
 if not exists(select 1 from public.admin_profiles where id=actor and is_active and role in ('super_admin','admin','editor')) then raise exception 'Inactive actor' using errcode='42501';end if;
 select * into p from public.products where id=product for update;
 if p.id is null or p.status<>'draft' or p.deleted_at is not null then raise exception 'An undeleted draft is required';end if;
 if p.revision<>expected_revision then raise exception 'Product changed; reload' using errcode='40001';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
end $$;
-- Avoid invalidating already published category specification rules in place.
-- Unpublish affected products before changing required category rules or attribute types.
create function private.dictionary_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='category_attributes' then
 if exists(select 1 from public.products where primary_category_id=new.category_id and status='published' and deleted_at is null) then raise exception 'Unpublish affected products before changing category specification rules';end if;
 elsif tg_table_name='attribute_definitions' then
 if new.data_type<>old.data_type and (exists(select 1 from public.product_attribute_values where attribute_id=new.id) or exists(select 1 from public.variant_attribute_values where attribute_id=new.id)) then raise exception 'Referenced attribute types are immutable; create a new definition';end if;
 elsif tg_table_name='units' then
 if new.unit_family<>old.unit_family or new.factor_to_base is distinct from old.factor_to_base then raise exception 'Unit conversion semantics are immutable; create a new unit';end if;
 end if;return new;
end $$;
create trigger category_rules_guard before insert or update on public.category_attributes for each row execute function private.dictionary_guard();
create trigger attribute_definition_guard before update on public.attribute_definitions for each row execute function private.dictionary_guard();
create trigger units_semantics_guard before update on public.units for each row execute function private.dictionary_guard();
create index products_code_trgm on public.products using gin(product_code extensions.gin_trgm_ops);
create index brands_name_trgm on public.brands using gin(name extensions.gin_trgm_ops);
create view public_catalog.variants with (security_barrier=true) as
select v.id,v.product_id,v.sku,v.variant_name,v.model_number,v.manufacturer_part_number,u.symbol as sale_unit,v.minimum_order_qty::text as minimum_order_qty,mu.symbol as minimum_order_unit,v.monthly_supply_capacity::text as monthly_supply_capacity,cu.symbol as capacity_unit,v.lead_time_days,v.availability_status,v.is_default,
coalesce((select jsonb_agg(jsonb_build_object('id',pr.id,'currency',pr.currency_code,'type',pr.price_type,'min',pr.min_price::text,'max',pr.max_price::text,'unit',pu.symbol,'trade_term',pr.trade_term,'valid_until',pr.valid_until,'tiers',coalesce((select jsonb_agg(jsonb_build_object('min_quantity',t.min_quantity::text,'max_quantity',t.max_quantity::text,'unit_price',t.unit_price::text,'unit',tu.symbol) order by t.min_quantity) from public.price_tiers t join public.units tu on tu.id=t.quantity_unit_id where t.variant_price_id=pr.id),'[]'::jsonb))) from public.variant_prices pr join public.units pu on pu.id=pr.price_unit_id where pr.variant_id=v.id and pr.is_active and pr.valid_from<=now() and (pr.valid_until is null or pr.valid_until>now())),'[]'::jsonb) as prices,
coalesce((select jsonb_agg(jsonb_build_object('code',a.code,'label',a.name,'text',av.value_text,'number',av.value_number::text,'boolean',av.value_boolean,'option',o.label,'unit',au.symbol)) from public.variant_attribute_values av join public.attribute_definitions a on a.id=av.attribute_id left join public.attribute_options o on o.id=av.option_id left join public.units au on au.id=av.unit_id where av.variant_id=v.id and a.is_active),'[]'::jsonb) as specifications
from public.product_variants v join public.products p on p.id=v.product_id join public.categories c on c.id=p.primary_category_id join public.units u on u.id=v.base_unit_id join public.units mu on mu.id=v.minimum_order_unit_id join public.units cu on cu.id=v.capacity_unit_id
where p.status='published' and p.deleted_at is null and c.is_active and v.is_active;
create view public_catalog.documents with (security_barrier=true) as select d.id,d.product_id,d.variant_id,d.title,d.document_type from public.product_documents d join public.products p on p.id=d.product_id join public.categories c on c.id=p.primary_category_id where p.status='published' and p.deleted_at is null and c.is_active and d.is_public;
grant select on public_catalog.variants,public_catalog.documents to anon,authenticated;
revoke execute on function private.dictionary_guard() from public,anon,authenticated;


-- SOURCE 20261024000800_outbox.sql SHA256 bda028a563f8cccfbef6069c8e7e683b8b7ad77df8a074ce482783cac12e06dc

-- Durable bounded outbox consumer. PGMQ/Cron installation is environment specific;
-- this ledger works without extensions and is the authoritative recovery record.
alter table private.outbox_events add column lease_until timestamptz,add column last_error text,add column dead_lettered_at timestamptz;
create index outbox_available on private.outbox_events(available_at,created_at) where completed_at is null and dead_lettered_at is null;
create function public.claim_catalog_jobs(batch_size integer default 10) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if batch_size<1 or batch_size>25 then raise exception 'Invalid batch size';end if;
 with picked as (select id from private.outbox_events where completed_at is null and dead_lettered_at is null and available_at<=now() and (lease_until is null or lease_until<now()) order by created_at for update skip locked limit batch_size),claimed as (update private.outbox_events e set lease_until=now()+interval '120 seconds',attempts=attempts+1 from picked where e.id=picked.id returning e.*) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]') into result from claimed;
 return result;
end $$;
create function public.complete_catalog_job(job uuid,attempt integer,success boolean,error_text text default '') returns void language plpgsql security definer set search_path='' as $$
begin
 update private.outbox_events set completed_at=case when success then now() else null end,lease_until=null,last_error=case when success then null else left(error_text,500) end,available_at=now()+make_interval(secs=>least(3600,power(2,least(attempts,10))::integer*5)),dead_lettered_at=case when not success and attempts>=8 then now() else null end where id=job and attempts=attempt and completed_at is null;
end $$;
create function public.image_asset_referenced(asset text) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.product_media where provider_asset_id=asset) or exists(select 1 from public.categories where image_path like '%'||asset||'%') or exists(select 1 from public.brands where logo_path like '%'||asset||'%') $$;
revoke execute on function public.claim_catalog_jobs(integer),public.complete_catalog_job(uuid,integer,boolean,text),public.image_asset_referenced(text) from public,anon,authenticated;
grant execute on function public.claim_catalog_jobs(integer),public.complete_catalog_job(uuid,integer,boolean,text),public.image_asset_referenced(text) to service_role;
revoke all on private.outbox_events from public,anon,authenticated;


-- SOURCE 20261024000900_query_guards.sql SHA256 012e286a08ba6d0ad0bf5baaa1bd5f8e962c09cc74e2dad1e6a02ff3d727b4d0

-- Evaluate the current profile once per SQL statement rather than once per row.
do $$declare t text;begin
 for t in select tablename from pg_tables where schemaname='public' and tablename not in ('admin_profiles','audit_logs') loop
 execute format('drop policy active_admin_read on public.%I',t);
 execute format('create policy active_admin_read on public.%I for select to authenticated using((select private.current_role()) is not null)',t);
 end loop;
end $$;
drop policy audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select to authenticated using((select private.current_role()) in ('super_admin','admin'));
create or replace function private.attribute_guard() returns trigger language plpgsql set search_path='' as $$
declare dtype text; duplicate boolean; owner_id uuid;
begin
 select data_type into dtype from public.attribute_definitions where id=new.attribute_id for share;
 if (dtype='text' and new.value_text is null) or (dtype='number' and new.value_number is null) or (dtype='boolean' and new.value_boolean is null) or (dtype in ('select','multi_select') and new.option_id is null) then raise exception 'Attribute % requires % value',new.attribute_id,dtype; end if;
 owner_id=coalesce(to_jsonb(new)->>'product_id',to_jsonb(new)->>'variant_id')::uuid;
 -- Tuple locks serialize cardinality without one advisory-lock entry per SKU.
 if tg_table_name='product_attribute_values' then perform 1 from public.products where id=owner_id for update;
 else perform 1 from public.product_variants where id=owner_id for update;end if;
 execute format('select exists(select 1 from public.%I where %I=$1 and attribute_id=$2 and id<>$3 and ($4<>''multi_select'' or option_id=$5))',tg_table_name,case when tg_table_name='product_attribute_values' then 'product_id' else 'variant_id' end) into duplicate using owner_id,new.attribute_id,new.id,dtype,new.option_id;
 if duplicate then raise exception 'Duplicate value for attribute %',new.attribute_id; end if;return new;
end $$;
-- Changing category composition rules must also preserve published invariants.
create function private.category_composition_guard() returns trigger language plpgsql set search_path='' as $$begin
 if new.requires_composition is distinct from old.requires_composition and exists(select 1 from public.products where primary_category_id=new.id and status='published' and deleted_at is null) then raise exception 'Unpublish affected products before changing composition rules';end if;return new;end$$;
create trigger category_composition_guard before update on public.categories for each row execute function private.category_composition_guard();
revoke execute on function private.category_composition_guard() from public,anon,authenticated;


-- SOURCE 20261024001000_domain_checks.sql SHA256 299ea873edf4247156f753cbde1bf1a2f1ec544182e054aea828c3e9ed2a077c

alter table public.products add check(length(trim(name))>=2),add check(product_code=trim(product_code) and length(product_code)>=2),add check(country_of_origin is null or country_of_origin ~ '^[A-Z]{2}$');
alter table public.product_variants add check(sku=trim(sku) and length(sku)>0),add check(length(trim(variant_name))>0);
alter table public.categories add check(length(trim(name))>0),add check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
alter table public.brands add check(length(trim(name))>0),add check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),add check(country_code is null or country_code ~ '^[A-Z]{2}$');
alter table public.industries add check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
alter table public.applications add check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
create or replace function private.category_tree_guard() returns trigger language plpgsql set search_path='' as $$
declare depth integer; subtree_depth integer; cyclic boolean;
begin
 perform pg_advisory_xact_lock(7241862);
 with recursive ancestors as (
 select c.id,c.parent_id,1 as n,array[c.id] as visited from public.categories c where c.id=new.parent_id
 union all select c.id,c.parent_id,a.n+1,a.visited||c.id from public.categories c join ancestors a on c.id=a.parent_id where a.n<9 and not c.id=any(a.visited)
 ) select coalesce(max(n),0),coalesce(bool_or(id=new.id),false) into depth,cyclic from ancestors;
 with recursive children as (
 select new.id as id,1 as n,array[new.id] as visited
 union all select c.id,ch.n+1,ch.visited||c.id from public.categories c join children ch on c.parent_id=ch.id where ch.n<9 and not c.id=any(ch.visited)
 ) select max(n) into subtree_depth from children;
 if cyclic or depth+subtree_depth>8 then raise exception 'Category would create a cycle or exceed depth 8'; end if;return new;
end $$;
create function private.tier_unit_guard() returns trigger language plpgsql set search_path='' as $$
declare p public.variant_prices;
begin
 select * into p from public.variant_prices where id=new.variant_price_id;
 if p.price_type='on_request' then raise exception 'On-request prices cannot define numeric tiers';end if;
 if new.quantity_unit_id is distinct from p.price_unit_id then raise exception 'Tier quantity units must match the price unit; convert explicitly before entry';end if;
 return new;
end $$;
create trigger tier_unit_guard before insert or update on public.price_tiers for each row execute function private.tier_unit_guard();
revoke execute on function private.tier_unit_guard() from public,anon,authenticated;


-- SOURCE 20261024001100_concurrent_publication.sql SHA256 71710fbe9f88846e9af861a2959357b25e78be544d6329e83df9658181c76712

create or replace function public.manage_admin(actor uuid,target uuid,display_name text,new_role text,active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 -- Serialize role changes so two super admins cannot disable each other concurrently.
 perform pg_advisory_xact_lock(3172456);
 if actor=target or not exists(select 1 from public.admin_profiles where id=actor and is_active and role='super_admin') then raise exception 'Role change denied' using errcode='42501';end if;
 if new_role not in ('super_admin','admin','editor') or length(trim(display_name))<2 then raise exception 'Invalid administrator details';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 insert into public.admin_profiles(id,full_name,role,is_active) values(target,display_name,new_role,active) on conflict(id) do update set full_name=excluded.full_name,role=excluded.role,is_active=excluded.is_active;
end $$;
create function private.lock_category_rules() returns trigger language plpgsql set search_path='' as $$begin
 perform 1 from public.categories where id=new.category_id for update;return new;
end$$;
-- Trigger names sort before the rule guard: take the category lock before checking publication.
create trigger category_00_lock before insert or update on public.category_attributes for each row execute function private.lock_category_rules();
create function private.recheck_publication() returns trigger language plpgsql security definer set search_path='' as $$
declare errors jsonb;
begin
 if new.status='published' and (old.status<>'published' or new.primary_category_id is distinct from old.primary_category_id) then
 perform 1 from public.categories where id=new.primary_category_id for share;
 errors=private.publish_errors(new.id);
 if jsonb_array_length(errors)>0 then raise exception '%',errors::text using errcode='23514';end if;
 end if;return new;
end$$;
create trigger product_publication_guard before update on public.products for each row execute function private.recheck_publication();
revoke execute on function private.lock_category_rules(),private.recheck_publication() from public,anon,authenticated;


-- SOURCE 20261024001200_r2_media.sql SHA256 3243bb8d2a4d782537440ca61c3b25ee31a4d0acb2b6e465c934b384c530f7ff
-- Additive upgrade: preserve all existing media, audit history and the 28 core entities.

alter table public.product_media
 add column staging_key text unique,
 add column staging_bucket text,
 add column public_bucket text,
 add column delivery_origin text,
 add column upload_expires_at timestamptz,
 add column verification_token uuid,
 add column verification_lease_until timestamptz,
 add column object_manifest jsonb not null default '[]',
 add column sha256 text,
 add column verified_at timestamptz,
 add column retired_at timestamptz,
 add column replaces_media_id uuid references public.product_media(id) on delete restrict;
do $$declare c record;begin
 for c in select conname from pg_constraint where conrelid='public.product_media'::regclass and contype='c' and conkey && array(select attnum from pg_attribute where attrelid='public.product_media'::regclass and attname in ('provider','delivery_url','upload_status')) loop
 execute format('alter table public.product_media drop constraint %I',c.conname);
 end loop;
end$$;
alter table public.product_media
 add constraint media_provider_check check(provider in ('cloudflare_images','r2')),
 add constraint media_state_check check(upload_status in ('pending','verifying','ready','failed','retired')),
 add constraint media_ready_check check(upload_status<>'ready' or (provider_asset_id is not null and delivery_url is not null and retired_at is null)),
 add constraint media_primary_check check(not is_primary or (upload_status='ready' and retired_at is null)),
 add constraint media_url_check check(delivery_url is null or (provider='cloudflare_images' and delivery_url ~ '^https://imagedelivery.net/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+$') or (provider='r2' and delivery_origin is not null and delivery_url like delivery_origin||'/catalog/%/detail.webp')),
 add constraint media_manifest_check check(jsonb_typeof(object_manifest)='array' and jsonb_array_length(object_manifest)<=3),
 add constraint media_hash_check check(sha256 is null or sha256 ~ '^[a-f0-9]{64}$');

create function public.r2_create_upload(actor uuid,product uuid,expected_revision bigint,media uuid,mime text,size_bytes bigint,origin text,staging_bucket_name text,public_bucket_name text,replacement uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare expires timestamptz=now()+interval '5 minutes';
begin
 perform private.integration_actor(actor,product,expected_revision);
 perform pg_advisory_xact_lock(hashtextextended('image-quota:'||actor::text,0));
 if mime not in ('image/jpeg','image/png','image/webp') or size_bytes<1 or size_bytes>10485760 then raise exception 'Invalid image declaration';end if;
 if origin !~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?$' and origin !~ '^http://(127\.0\.0\.1|localhost):[0-9]+$' then raise exception 'Invalid delivery origin';end if;
 if (select count(*) from public.product_media where uploaded_by=actor and created_at>now()-interval '1 hour')>=50 then raise exception 'Hourly upload quota reached';end if;
 if staging_bucket_name !~ '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$' or public_bucket_name !~ '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$' or staging_bucket_name=public_bucket_name then raise exception 'Invalid R2 buckets';end if;
 if replacement is not null and not exists(select 1 from public.product_media where id=replacement and product_id=product and upload_status='ready' and retired_at is null) then raise exception 'Replacement image not found';end if;
 insert into public.product_media(id,product_id,media_type,provider,provider_asset_id,staging_key,delivery_origin,uploaded_by,content_type,bytes,upload_expires_at,replaces_media_id,staging_bucket,public_bucket)
 values(media,product,'image','r2','catalog/'||product||'/'||media,'staging/'||product||'/'||media,origin,actor,mime,size_bytes,expires,replacement,staging_bucket_name,public_bucket_name);
 -- Every issued capability has a durable cleanup task, even if the browser disappears.
 insert into private.outbox_events(entity_id,event_type,revision,payload,available_at) values(media,'r2.cleanup',0,jsonb_build_object('media_id',media),expires+interval '10 minutes');
 return jsonb_build_object('media',media,'expires_at',expires);
end$$;

create function public.r2_claim_upload(actor uuid,product uuid,expected_revision bigint,media uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.product_media;token uuid=gen_random_uuid();
begin
 perform private.integration_actor(actor,product,expected_revision);
 select * into m from public.product_media where id=media and product_id=product and uploaded_by=actor and provider='r2' for update;
 if m.id is null then raise exception 'Upload ownership mismatch' using errcode='42501';end if;
 if m.upload_status='ready' then return jsonb_build_object('ready',true);end if;
 if m.retired_at is not null or m.upload_status='failed' or m.upload_expires_at<=now() then raise exception 'Upload session expired or failed; start a new upload';end if;
 if m.verification_lease_until>now() then raise exception 'This upload is already being verified' using errcode='40001';end if;
 -- A previous planned promotion must be reconciled before another attempt.
 if jsonb_array_length(m.object_manifest)>0 then raise exception 'Promotion recovery is pending; start a new upload';end if;
 update public.product_media set upload_status='verifying',verification_token=token,verification_lease_until=now()+interval '5 minutes' where id=media;
 return jsonb_build_object('token',token,'staging_key',m.staging_key,'bytes',m.bytes,'mime',m.content_type,'origin',m.delivery_origin,'staging_bucket',m.staging_bucket,'public_bucket',m.public_bucket);
end$$;

create function public.r2_plan_promotion(actor uuid,media uuid,token uuid,manifest jsonb,digest text,image_width integer,image_height integer) returns void language plpgsql security definer set search_path='' as $$
declare m public.product_media;e jsonb; kinds text[]='{}';
begin
 select * into m from public.product_media where id=media for update;
 if m.uploaded_by is distinct from actor or m.upload_status<>'verifying' or m.verification_token is distinct from token or m.verification_lease_until<=now() then raise exception 'Verification lease lost' using errcode='40001';end if;
 if not exists(select 1 from public.admin_profiles where id=actor and is_active) then raise exception 'Inactive actor' using errcode='42501';end if;
 if jsonb_typeof(manifest)<>'array' or jsonb_array_length(manifest)<>3 or digest !~ '^[a-f0-9]{64}$' or image_width not between 100 and 12000 or image_height not between 100 and 12000 then raise exception 'Invalid verified manifest';end if;
 for e in select value from jsonb_array_elements(manifest) loop
 if e->>'kind' not in ('thumbnail','card','detail') or e->>'key' is distinct from m.provider_asset_id||'/'||token||'/'||(e->>'kind')||'.webp' or e->>'url' is distinct from m.delivery_origin||'/'||(e->>'key') or (e->>'bytes')::bigint not between 1 and 20971520 or (e->>'width')::integer not between 1 and 2000 or (e->>'height')::integer not between 1 and 2000 or e->>'sha256' !~ '^[a-f0-9]{64}$' then raise exception 'Invalid public object manifest';end if;
 kinds=array_append(kinds,e->>'kind');
 end loop;
 if not kinds @> array['thumbnail','card','detail'] then raise exception 'Missing responsive image size';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 update public.product_media set object_manifest=manifest,sha256=digest,width=image_width,height=image_height where id=media;
end$$;

create function public.r2_finish_upload(actor uuid,product uuid,expected_revision bigint,media uuid,token uuid) returns bigint language plpgsql security definer set search_path='' as $$
declare m public.product_media;old_media public.product_media;result bigint;
begin
 -- Idempotent success does not mutate again or consume another revision.
 select * into m from public.product_media where id=media and product_id=product and uploaded_by=actor and provider='r2';
 if m.id is null then raise exception 'Upload ownership mismatch' using errcode='42501';end if;
 if m.upload_status='ready' then if not exists(select 1 from public.admin_profiles where id=actor and is_active) then raise exception 'Inactive actor' using errcode='42501';end if;select revision into result from public.products where id=product;return result;end if;
 perform private.integration_actor(actor,product,expected_revision);
 select * into m from public.product_media where id=media for update;
 if m.upload_status<>'verifying' or m.verification_token is distinct from token or m.verification_lease_until<=now() or jsonb_array_length(m.object_manifest)<>3 then raise exception 'Verification lease lost' using errcode='40001';end if;
 if m.replaces_media_id is not null then
 select * into old_media from public.product_media where id=m.replaces_media_id and product_id=product and upload_status='ready' and retired_at is null for update;
 if old_media.id is null then raise exception 'Replacement target changed' using errcode='40001';end if;
 update public.product_media set is_primary=false,upload_status='retired',retired_at=now() where id=old_media.id;
 insert into private.outbox_events(entity_id,event_type,revision,payload,available_at) values(old_media.id,'image.retired',expected_revision,jsonb_build_object('media_id',old_media.id,'provider',old_media.provider,'asset_id',old_media.provider_asset_id),greatest(now(),coalesce(old_media.upload_expires_at+interval '10 minutes',now())));
 end if;
 update public.product_media set upload_status='ready',verified_at=now(),delivery_url=(select e->>'url' from jsonb_array_elements(m.object_manifest) e where e->>'kind'='detail'),external_url=(select e->>'url' from jsonb_array_elements(m.object_manifest) e where e->>'kind'='detail'),is_primary=case when old_media.id is not null then old_media.is_primary else not exists(select 1 from public.product_media where product_id=product and is_primary and upload_status='ready') end,sort_order=coalesce(old_media.sort_order,m.sort_order),variant_id=coalesce(old_media.variant_id,m.variant_id),alt_text=coalesce(old_media.alt_text,m.alt_text),verification_lease_until=null where id=media;
 update public.products set revision=revision+1,updated_by=actor where id=product returning revision into result;
 return result;
end$$;

create function public.r2_fail_upload(actor uuid,media uuid,token uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from public.admin_profiles where id=actor and is_active) then raise exception 'Inactive actor' using errcode='42501';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 update public.product_media set upload_status='failed',verification_lease_until=null where id=media and uploaded_by=actor and verification_token=token and upload_status='verifying';
end$$;

create or replace function private.media_action(product uuid,expected_revision bigint,media uuid,operation text,alt text) returns bigint language plpgsql security definer set search_path='' as $$
declare m public.product_media;result bigint;
begin
 perform private.require_role(array['super_admin','admin','editor']);perform private.integration_actor(auth.uid(),product,expected_revision);
 select * into m from public.product_media where id=media and product_id=product and retired_at is null for update;if m.id is null then raise exception 'Image not found';end if;
 if operation='primary' and m.upload_status='ready' then update public.product_media set is_primary=false where product_id=product;update public.product_media set is_primary=true where id=media;
 elsif operation='alt' then update public.product_media set alt_text=left(alt,255) where id=media;
 elsif operation='detach' then update public.product_media set upload_status='retired',retired_at=now(),is_primary=false,verification_token=null,verification_lease_until=null where id=media;
 elsif operation='order' and alt ~ '^[0-9]{1,6}$' then update public.product_media set sort_order=alt::integer where id=media;
 else raise exception 'Invalid media action';end if;
 update public.products set revision=revision+1,updated_by=auth.uid() where id=product returning revision into result;
 if operation='detach' then insert into private.outbox_events(entity_id,event_type,revision,payload,available_at) values(media,'image.retired',result,jsonb_build_object('media_id',media,'provider',m.provider,'asset_id',m.provider_asset_id),greatest(now(),coalesce(m.upload_expires_at+interval '10 minutes',now())));end if;
 return result;
end$$;

create function public.r2_prepare_cleanup(media uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.product_media;keys jsonb='[]';e jsonb;
begin
 select * into m from public.product_media where id=media for update;
 if m.id is null or m.provider<>'r2' then raise exception 'R2 media not found';end if;
 if m.upload_expires_at+interval '10 minutes'>now() or m.verification_lease_until>now() then raise exception 'Upload capability or verification lease is still active';end if;
 if m.upload_status not in ('ready','retired') then update public.product_media set upload_status='failed',verification_token=null,verification_lease_until=null where id=media;end if;
 if m.upload_status<>'ready' then
 for e in select value from jsonb_array_elements(m.object_manifest) loop
 if not exists(select 1 from public.product_media other cross join lateral jsonb_array_elements(other.object_manifest) entry where other.id<>m.id and other.upload_status='ready' and entry->>'key'=e->>'key') and not exists(select 1 from public.categories where image_path=e->>'url') and not exists(select 1 from public.brands where logo_path=e->>'url') then keys=keys||jsonb_build_array(e);end if;
 end loop;end if;
 return jsonb_build_object('staging_key',m.staging_key,'objects',keys,'origin',m.delivery_origin);
end$$;
-- Existing legacy jobs remain provider-aware. Historical/retired rows are not live references.
create or replace function public.image_asset_referenced(asset text) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.product_media where provider_asset_id=asset and retired_at is null and upload_status in ('ready','pending','verifying')) or exists(select 1 from public.categories where image_path like '%'||asset||'%') or exists(select 1 from public.brands where logo_path like '%'||asset||'%') $$;

-- Close old upload capabilities without deleting old ready media or old PDF functions.
revoke execute on function public.stage_image(uuid,uuid,bigint,text,text,bigint),public.attach_verified_image(uuid,uuid,bigint,uuid,text) from service_role;
revoke execute on function public.r2_create_upload(uuid,uuid,bigint,uuid,text,bigint,text,text,text,uuid),public.r2_claim_upload(uuid,uuid,bigint,uuid),public.r2_plan_promotion(uuid,uuid,uuid,jsonb,text,integer,integer),public.r2_finish_upload(uuid,uuid,bigint,uuid,uuid),public.r2_fail_upload(uuid,uuid,uuid),public.r2_prepare_cleanup(uuid) from public,anon,authenticated;
grant execute on function public.r2_create_upload(uuid,uuid,bigint,uuid,text,bigint,text,text,text,uuid),public.r2_claim_upload(uuid,uuid,bigint,uuid),public.r2_plan_promotion(uuid,uuid,uuid,jsonb,text,integer,integer),public.r2_finish_upload(uuid,uuid,bigint,uuid,uuid),public.r2_fail_upload(uuid,uuid,uuid),public.r2_prepare_cleanup(uuid) to service_role;
-- Append a safe responsive projection without changing any existing public fields.
create or replace view public_catalog.products with (security_barrier=true) as
select p.id,p.name,p.slug,p.product_code,p.short_description,p.description,p.product_type,p.country_of_origin,p.is_featured,p.is_new_arrival,p.seo_title,p.seo_description,p.published_at,p.updated_at,c.name as category_name,c.slug as category_slug,b.name as brand_name,
(select m.delivery_url from public.product_media m where m.product_id=p.id and m.is_primary and m.upload_status='ready' limit 1) as image_url,
coalesce((select jsonb_agg(jsonb_build_object('kind',e->>'kind','url',e->>'url','width',(e->>'width')::integer,'height',(e->>'height')::integer)) from public.product_media m cross join lateral jsonb_array_elements(m.object_manifest) e where m.product_id=p.id and m.is_primary and m.upload_status='ready'),'[]'::jsonb) as image_variants
from public.products p join public.categories c on c.id=p.primary_category_id left join public.brands b on b.id=p.brand_id where p.status='published' and p.deleted_at is null and c.is_active;


-- SOURCE 20261024001300_r2_cleanup_bucket_contract.sql SHA256 9ad4d8dd7f54fe601e54a738de264af321d9111d31fc1de5a90edfc000a1b0c8
-- Preserve migration history and data; include pinned bucket names expected by the worker.

create or replace function public.r2_prepare_cleanup(media uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m public.product_media;keys jsonb='[]';e jsonb;
begin
 select * into m from public.product_media where id=media for update;
 if m.id is null or m.provider<>'r2' then raise exception 'R2 media not found';end if;
 if m.upload_expires_at+interval '10 minutes'>now() or m.verification_lease_until>now() then raise exception 'Upload capability or verification lease is still active';end if;
 if m.upload_status not in ('ready','retired') then update public.product_media set upload_status='failed',verification_token=null,verification_lease_until=null where id=media;end if;
 if m.upload_status<>'ready' then
 for e in select value from jsonb_array_elements(m.object_manifest) loop
 if not exists(select 1 from public.product_media other cross join lateral jsonb_array_elements(other.object_manifest) entry where other.id<>m.id and other.upload_status='ready' and entry->>'key'=e->>'key') and not exists(select 1 from public.categories where image_path=e->>'url') and not exists(select 1 from public.brands where logo_path=e->>'url') then keys=keys||jsonb_build_array(e);end if;
 end loop;end if;
 return jsonb_build_object('staging_key',m.staging_key,'staging_bucket',m.staging_bucket,'public_bucket',m.public_bucket,'objects',keys,'origin',m.delivery_origin);
end$$;
-- CREATE OR REPLACE preserves the existing service-role-only grants.


-- SOURCE 20261024001400_public_image_keys.sql SHA256 f4c1ff91eedc9fdec88876812a2cc221c389f8af09d90bc3ccfa55881a2e79c0
-- Object keys are canonical; URLs remain compatible delivery hints for existing consumers.
-- No product_media columns, rows, permissions or authentication behavior change.

create or replace view public_catalog.products with (security_barrier=true) as
select p.id,p.name,p.slug,p.product_code,p.short_description,p.description,p.product_type,p.country_of_origin,p.is_featured,p.is_new_arrival,p.seo_title,p.seo_description,p.published_at,p.updated_at,c.name as category_name,c.slug as category_slug,b.name as brand_name,
(select m.delivery_url from public.product_media m where m.product_id=p.id and m.is_primary and m.upload_status='ready' limit 1) as image_url,
coalesce((select jsonb_agg(jsonb_build_object('kind',e->>'kind','url',e->>'url','width',(e->>'width')::integer,'height',(e->>'height')::integer,'key',e->>'key')) from public.product_media m cross join lateral jsonb_array_elements(m.object_manifest) e where m.product_id=p.id and m.is_primary and m.upload_status='ready'),'[]'::jsonb) as image_variants,
(select e->>'key' from public.product_media m cross join lateral jsonb_array_elements(m.object_manifest) e where m.product_id=p.id and m.is_primary and m.upload_status='ready' and m.provider='r2' and e->>'kind'='detail' limit 1) as image_key
from public.products p join public.categories c on c.id=p.primary_category_id left join public.brands b on b.id=p.brand_id where p.status='published' and p.deleted_at is null and c.is_active;
-- A URL on a former/current delivery origin can reference the same canonical key.
create or replace function public.r2_prepare_cleanup(media uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m public.product_media;keys jsonb='[]';e jsonb;
begin
 select * into m from public.product_media where id=media for update;
 if m.id is null or m.provider<>'r2' then raise exception 'R2 media not found';end if;
 if m.upload_expires_at+interval '10 minutes'>now() or m.verification_lease_until>now() then raise exception 'Upload capability or verification lease is still active';end if;
 if m.upload_status not in ('ready','retired') then update public.product_media set upload_status='failed',verification_token=null,verification_lease_until=null where id=media;end if;
 if m.upload_status<>'ready' then
 for e in select value from jsonb_array_elements(m.object_manifest) loop
 if not exists(select 1 from public.product_media other cross join lateral jsonb_array_elements(other.object_manifest) entry where other.id<>m.id and other.upload_status='ready' and entry->>'key'=e->>'key')
 and not exists(select 1 from public.categories where image_path=e->>'url' or split_part(split_part(image_path,'?',1),'#',1) like '%/'||(e->>'key'))
 and not exists(select 1 from public.brands where logo_path=e->>'url' or split_part(split_part(logo_path,'?',1),'#',1) like '%/'||(e->>'key')) then keys=keys||jsonb_build_array(e);end if;
 end loop;end if;
 return jsonb_build_object('staging_key',m.staging_key,'staging_bucket',m.staging_bucket,'public_bucket',m.public_bucket,'objects',keys,'origin',m.delivery_origin);
end$$;


-- Schema/privilege verification only: no fixtures, account creation or storage writes.
do $ann_postflight$
declare signature text;
begin
 if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r')<>28
    or (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity)<>28 then
   raise exception 'Expected 28 core tables with RLS';
 end if;
 foreach signature in array array[
   'public.r2_create_upload(uuid,uuid,bigint,uuid,text,bigint,text,text,text,uuid)',
   'public.r2_claim_upload(uuid,uuid,bigint,uuid)',
   'public.r2_plan_promotion(uuid,uuid,uuid,jsonb,text,integer,integer)',
   'public.r2_finish_upload(uuid,uuid,bigint,uuid,uuid)',
   'public.r2_fail_upload(uuid,uuid,uuid)',
   'public.r2_prepare_cleanup(uuid)'
 ] loop
   if not has_function_privilege('service_role',signature,'EXECUTE')
      or has_function_privilege('authenticated',signature,'EXECUTE')
      or has_function_privilege('anon',signature,'EXECUTE') then
     raise exception 'Incorrect R2 RPC privilege: %',signature;
   end if;
 end loop;
 if has_function_privilege('service_role','public.attach_verified_image(uuid,uuid,bigint,uuid,text)','EXECUTE')
    or has_function_privilege('service_role','public.stage_image(uuid,uuid,bigint,text,text,bigint)','EXECUTE') then
   raise exception 'Legacy image upload capability is still enabled';
 end if;
 if not exists(select 1 from information_schema.columns where table_schema='public_catalog' and table_name='products' and column_name='image_key')
    or not has_table_privilege('anon','public_catalog.products','SELECT')
    or has_table_privilege('anon','public.products','SELECT') then
   raise exception 'Public catalog projection or access is incorrect';
 end if;
 if not exists(select 1 from storage.buckets where id='catalog-documents' and public=false and file_size_limit=10485760 and allowed_mime_types=array['application/pdf']) then
   raise exception 'Private PDF bucket configuration is incorrect';
 end if;
end $ann_postflight$;

notify pgrst, 'reload schema';
commit;
