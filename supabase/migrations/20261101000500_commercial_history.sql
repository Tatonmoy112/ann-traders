begin;
-- Additional specification families share the existing reusable units dictionary.
alter table public.units drop constraint units_unit_family_check;
alter table public.units add constraint units_unit_family_check check(unit_family in (
  'mass','length','volume','count','areal_density','other','area','power','electric_potential','frequency','time','temperature','ratio'));

create function private.price_context_guard() returns trigger language plpgsql set search_path='' as $$
begin
  -- Serialize canonical-context checks with competing writers for this SKU.
  perform 1 from public.product_variants where id=new.variant_id for update;
  if tg_op='INSERT' then new.trade_term=upper(btrim(new.trade_term)); end if;
  if new.is_active and exists(select 1 from public.variant_prices stored where stored.variant_id=new.variant_id
    and stored.id<>new.id and stored.is_active and stored.currency_code=new.currency_code
    and stored.price_unit_id=new.price_unit_id and upper(btrim(stored.trade_term))=upper(btrim(new.trade_term))
    and tstzrange(stored.valid_from,stored.valid_until,'[)') && tstzrange(new.valid_from,new.valid_until,'[)'))
  then raise exception 'Active price periods overlap in the same currency, unit and trade context' using errcode='23P01'; end if;
  return new;
end $$;
create trigger price_context_guard before insert or update on public.variant_prices
  for each row execute function private.price_context_guard();
revoke execute on function private.price_context_guard() from public,anon,authenticated;

-- Frozen tier rows can be submitted unchanged, but cannot be edited/removed.
-- products.published_at is retained through withdrawal, preserving that boundary.
create function private.check_frozen_tiers(product uuid,rows jsonb) returns void
language plpgsql stable set search_path='' as $$
declare price record; existing jsonb; submitted jsonb;
begin
  for price in select pr.id from public.variant_prices pr join public.product_variants v on v.id=pr.variant_id
    join public.products p on p.id=v.product_id
    where p.id=product and p.published_at is not null and pr.created_at<=p.published_at loop
    select coalesce(jsonb_agg(to_jsonb(t)-'created_at'-'updated_at' order by t.id),'[]'::jsonb)
      into existing from public.price_tiers t where t.variant_price_id=price.id;
    select coalesce(jsonb_agg(to_jsonb(t)-'created_at'-'updated_at' order by t.id),'[]'::jsonb)
      into submitted from jsonb_populate_recordset(null::public.price_tiers,rows) t where t.variant_price_id=price.id;
    if existing is distinct from submitted then raise exception 'Published price tiers are immutable; append a replacement price and tiers'; end if;
  end loop;
end $$;
revoke execute on function private.check_frozen_tiers(uuid,jsonb) from public,anon,authenticated;
create or replace function private.save_relation(product uuid,expected_revision bigint,relation text,rows jsonb) returns bigint language plpgsql security definer set search_path='' as $$
declare p public.products; columns text; variant_owned boolean=false; result bigint;
begin
 perform private.require_role(array['super_admin','admin','editor']);
 select * into p from public.products where id=product for update;
 if p.id is null or p.status<>'draft' or p.deleted_at is not null then raise exception 'An undeleted draft is required'; end if;
 if p.revision is distinct from expected_revision then raise exception 'Product changed; reload' using errcode='40001'; end if;
 if jsonb_typeof(rows) is distinct from 'array' or jsonb_array_length(rows)>500 or octet_length(rows::text)>262144 then raise exception 'Invalid relationship rows'; end if;
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
 perform private.check_frozen_tiers(product,rows);
 if exists(select 1 from jsonb_array_elements(rows) r where not exists(select 1 from public.variant_prices pr join public.product_variants v on v.id=pr.variant_id where pr.id=(r->>'variant_price_id')::uuid and v.product_id=product)) then raise exception 'Foreign price';end if;
 execute 'delete from public.price_tiers where variant_price_id in (select pr.id from public.variant_prices pr join public.product_variants v on v.id=pr.variant_id join public.products p on p.id=v.product_id where v.product_id=$1 and (p.published_at is null or pr.created_at>p.published_at))' using product;
 else
 if exists(select 1 from jsonb_array_elements(rows) r where (r->>'product_id')::uuid is distinct from product) then raise exception 'Foreign product';end if;
 execute format('delete from public.%I where product_id=$1',relation) using product;
 end if;
 -- relation and columns come exclusively from the allowlist above, never client SQL.
 if relation='price_tiers' then
 execute format('insert into public.price_tiers(%s) select %s from jsonb_populate_recordset(null::public.price_tiers,$1) incoming where not exists(select 1 from public.variant_prices pr join public.product_variants v on v.id=pr.variant_id join public.products p on p.id=v.product_id where pr.id=incoming.variant_price_id and p.published_at is not null and pr.created_at<=p.published_at)',columns,columns) using rows;
 else
 execute format('insert into public.%I(%s) select %s from jsonb_populate_recordset(null::public.%I,$1)',relation,columns,columns,relation) using rows;
 end if;
 update public.products set revision=revision+1,updated_by=auth.uid() where id=product returning revision into result;
 return result;
end $$;
notify pgrst,'reload schema';
commit;
