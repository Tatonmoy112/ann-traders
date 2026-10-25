-- Fresh local/development schema. No remote application authorized.
begin;
create schema if not exists private;
create schema if not exists public_catalog;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists btree_gist with schema extensions;
set search_path=public,extensions;
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

commit;
