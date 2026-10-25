begin;
set search_path=public,extensions;
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
commit;
