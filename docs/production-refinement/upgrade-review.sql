-- REVIEW ONLY. Match target, ledger, prerequisite hashes and backup before operator-approved application.
-- Prefer the original versioned files through Supabase CLI so migration history is recorded.

-- 20261101000100_catalog_integrity.sql SHA256 e2a035aad93fe27338fb534e933a937d3e31ac7d387707cebe1e8d4e9ed0b8d3
-- Additive refinement. No existing records, identifiers or history are rewritten.
begin;

-- Closest primary-category rule wins for each (attribute, scope). Extra categories
-- are navigation placements and do not change technical requirements.
create function private.category_rules(category uuid)
returns table(attribute_id uuid,applies_to text,is_required boolean,sort_order integer,source_category_id uuid)
language sql stable security definer set search_path='' as $$
  with recursive ancestors as (
    select c.id,c.parent_id,0 as depth,array[c.id] as path from public.categories c where c.id=category
    union all
    select c.id,c.parent_id,a.depth+1,a.path||c.id
    from public.categories c join ancestors a on c.id=a.parent_id
    where a.depth<7 and not c.id=any(a.path)
  )
  select distinct on (ca.attribute_id,ca.applies_to)
    ca.attribute_id,ca.applies_to::text,ca.is_required,ca.sort_order,ca.category_id
  from ancestors a join public.category_attributes ca on ca.category_id=a.id
  order by ca.attribute_id,ca.applies_to,a.depth
$$;

create function public.get_category_attribute_rules(category uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.require_role(array['super_admin','admin','editor']);
  return coalesce((select jsonb_agg(to_jsonb(r) order by r.sort_order,r.attribute_id)
    from private.category_rules(category) r),'[]'::jsonb);
end $$;

create or replace function private.attribute_guard() returns trigger
language plpgsql set search_path='' as $$
declare a public.attribute_definitions; duplicate boolean; owner_id uuid; product_id uuid;
  category_id uuid; family text;
begin
  select * into a from public.attribute_definitions where id=new.attribute_id for share;
  if not coalesce(a.is_active,false) then raise exception 'Choose an active attribute'; end if;
  if (a.data_type='text' and new.value_text is null)
    or (a.data_type='number' and new.value_number is null)
    or (a.data_type='boolean' and new.value_boolean is null)
    or (a.data_type in ('select','multi_select') and new.option_id is null)
  then raise exception 'Attribute % requires % value',a.name,a.data_type; end if;
  if new.option_id is not null then
    if not exists(select 1 from public.attribute_options where id=new.option_id and attribute_id=a.id for share)
    then raise exception 'Option belongs to another attribute' using errcode='23503'; end if;
    if not exists(select 1 from public.attribute_options where id=new.option_id and is_active)
    then raise exception 'Choose an active option belonging to this attribute'; end if;
  end if;
  if a.data_type<>'number' and new.unit_id is not null then
    raise exception 'Only numeric specifications may have units';
  end if;
  if a.data_type='number' then
    new.unit_id=coalesce(new.unit_id,a.default_unit_id);
    if new.unit_id is not null then
      select u.unit_family into family from public.units u where u.id=new.unit_id and u.is_active for share;
      if family is null or a.default_unit_id is null or not exists(select 1 from public.units u
        where u.id=a.default_unit_id and u.is_active and u.unit_family=family for share)
      then raise exception 'Specification unit must match the active default unit family'; end if;
    end if;
  end if;
  owner_id=coalesce(to_jsonb(new)->>'product_id',to_jsonb(new)->>'variant_id')::uuid;
  if tg_table_name='product_attribute_values' then
    product_id=owner_id;
  else
    select v.product_id into product_id from public.product_variants v where v.id=owner_id;
  end if;
  -- Lock the aggregate first, consistently with all editor/publication RPCs.
  select p.primary_category_id into category_id from public.products p where p.id=product_id for update;
  if tg_table_name='variant_attribute_values' then
    perform 1 from public.product_variants where id=owner_id for update;
  end if;
  if not exists(select 1 from private.category_rules(category_id) r where r.attribute_id=a.id
    and r.applies_to=case when tg_table_name='product_attribute_values' then 'product' else 'variant' end)
  then raise exception 'Attribute % is not configured for this category and scope',a.name; end if;
  execute format('select exists(select 1 from public.%I where %I=$1 and attribute_id=$2 and id<>$3 and ($4<>''multi_select'' or option_id=$5))',
    tg_table_name,case when tg_table_name='product_attribute_values' then 'product_id' else 'variant_id' end)
    into duplicate using owner_id,a.id,new.id,a.data_type,new.option_id;
  if duplicate then raise exception 'Duplicate value for attribute %',a.name; end if;
  return new;
end $$;

-- Dictionary changes cannot invalidate a published descendant or reinterpret
-- stored specifications. The same category lock is taken during publication.
create or replace function private.dictionary_guard() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_table_name='category_attributes' then
    if tg_op='UPDATE' and (new.category_id,new.attribute_id,new.applies_to) is distinct from
      (old.category_id,old.attribute_id,old.applies_to) then
      raise exception 'Rule identity is immutable; edit its requirement or create another rule';
    end if;
    if exists(with recursive children as (
      select new.category_id as id union all select c.id from public.categories c join children ch on c.parent_id=ch.id
    ) select 1 from public.products p join children ch on ch.id=p.primary_category_id
      where p.status='published' and p.deleted_at is null)
    then raise exception 'Unpublish affected products before changing category specification rules'; end if;
  elsif tg_table_name='attribute_definitions' then
    if (new.data_type,new.default_unit_id,new.is_variant_axis) is distinct from
      (old.data_type,old.default_unit_id,old.is_variant_axis)
      and (exists(select 1 from public.product_attribute_values where attribute_id=new.id)
        or exists(select 1 from public.variant_attribute_values where attribute_id=new.id)) then
      raise exception 'Referenced attribute type, default unit and axis semantics are immutable; create a new definition';
    end if;
    if new.default_unit_id is not null and (new.data_type<>'number' or not exists(
      select 1 from public.units where id=new.default_unit_id and is_active)) then
      raise exception 'Only numeric attributes may declare an active default unit';
    end if;
  elsif tg_table_name='units' then
    if new.unit_family<>old.unit_family or new.factor_to_base is distinct from old.factor_to_base then
      raise exception 'Unit conversion semantics are immutable; create a new unit';
    end if;
  end if;
  return new;
end $$;
create trigger attribute_definition_insert_guard before insert on public.attribute_definitions
  for each row execute function private.dictionary_guard();

create function private.category_parent_publication_guard() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.parent_id is distinct from old.parent_id and exists(with recursive children as (
    select new.id union all select c.id from public.categories c join children ch on c.parent_id=ch.id
  ) select 1 from public.products p join children ch on ch.id=p.primary_category_id
    where p.status='published' and p.deleted_at is null)
  then raise exception 'Unpublish affected products before moving their category tree'; end if;
  return new;
end $$;
create trigger category_parent_publication_guard before update of parent_id on public.categories
  for each row execute function private.category_parent_publication_guard();

-- Keep the existing publication validator as the baseline, extending it with
-- inherited rules, legacy-data diagnostics and canonical variant combinations.
alter function private.publish_errors(uuid) rename to publish_errors_baseline;
create function private.publish_errors(product uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare errors jsonb; p public.products; r record; variant_row record;
begin
  errors=private.publish_errors_baseline(product);
  select * into p from public.products where id=product;
  if p.id is null then raise exception 'Product not found'; end if;
  if p.brand_id is not null and not exists(select 1 from public.brands where id=p.brand_id and is_active)
  then errors=errors||jsonb_build_array('Basics: brand must be active'); end if;
  if not exists(select 1 from public.product_media m where m.product_id=product and m.is_primary
    and m.upload_status='ready' and m.retired_at is null and (m.variant_id is null or exists(
      select 1 from public.product_variants v where v.id=m.variant_id and v.is_active)))
  then errors=errors||jsonb_build_array('Images: attach a verified primary image for an active variant or the whole product'); end if;
  if exists(select 1 from public.product_extra_categories ec join public.categories c on c.id=ec.category_id
    where ec.product_id=product and (not c.is_active or ec.category_id=p.primary_category_id))
  then errors=errors||jsonb_build_array('Classification: choose active additional categories distinct from the primary category'); end if;
  for r in select cr.*,a.name,a.is_variant_axis,a.is_active from private.category_rules(p.primary_category_id) cr
    join public.attribute_definitions a on a.id=cr.attribute_id loop
    if not r.is_active then
      errors=errors||jsonb_build_array('Specifications: category rule uses inactive attribute '||r.name);
    elsif r.is_required or (r.is_variant_axis and r.applies_to='variant') then
      if r.applies_to='product' and not exists(select 1 from public.product_attribute_values
        where product_id=product and attribute_id=r.attribute_id)
      then errors=errors||jsonb_build_array('Specifications: required '||r.name); end if;
      if r.applies_to='variant' then
        for variant_row in select * from public.product_variants where product_id=product and is_active loop
          if not exists(select 1 from public.variant_attribute_values where variant_id=variant_row.id and attribute_id=r.attribute_id)
          then errors=errors||jsonb_build_array(variant_row.sku||': required '||r.name); end if;
        end loop;
      end if;
    end if;
  end loop;
  if exists(
    with values_to_check as (
      select av.attribute_id,av.option_id,av.unit_id,'product' as scope from public.product_attribute_values av where av.product_id=product
      union all select av.attribute_id,av.option_id,av.unit_id,'variant' from public.variant_attribute_values av
        join public.product_variants v on v.id=av.variant_id where v.product_id=product and v.is_active
    ) select 1 from values_to_check av join public.attribute_definitions a on a.id=av.attribute_id
      left join public.units u on u.id=av.unit_id left join public.units du on du.id=a.default_unit_id
      left join public.attribute_options o on o.id=av.option_id
    where not a.is_active or (av.option_id is not null and not o.is_active)
      or (a.data_type<>'number' and av.unit_id is not null)
      or (a.data_type='number' and ((a.default_unit_id is not null and av.unit_id is null)
        or (av.unit_id is not null and (not u.is_active or du.id is null or not du.is_active or u.unit_family<>du.unit_family))))
      or not exists(select 1 from private.category_rules(p.primary_category_id) cr where cr.attribute_id=av.attribute_id and cr.applies_to=av.scope)
  ) then errors=errors||jsonb_build_array('Specifications: correct inactive, unmapped or incompatible specification values'); end if;
  for variant_row in select * from public.product_variants where product_id=product and is_active loop
    if exists(select 1 from public.variant_fiber_composition where variant_id=variant_row.id)
      and (select sum(percentage) from public.variant_fiber_composition where variant_id=variant_row.id)<>100
    then errors=errors||jsonb_build_array(variant_row.sku||': declared fiber composition must total 100%'); end if;
    if exists(select 1 from public.units where id in (variant_row.base_unit_id,variant_row.minimum_order_unit_id,variant_row.capacity_unit_id)
      and (not is_active or unit_family='areal_density'))
    then errors=errors||jsonb_build_array(variant_row.sku||': choose active commercial quantity units'); end if;
    if exists(select 1 from public.variant_prices pr join public.units u on u.id=pr.price_unit_id
      where pr.variant_id=variant_row.id and pr.is_active and pr.valid_from<=now() and (pr.valid_until is null or pr.valid_until>now())
        and (not u.is_active or u.unit_family='areal_density'))
    then errors=errors||jsonb_build_array(variant_row.sku||': current price units must be active quantity units'); end if;
  end loop;
  if exists(
    with signatures as (
      select v.id,(select jsonb_agg(jsonb_build_array(av.attribute_id,
        coalesce(to_jsonb(av.option_id),to_jsonb(lower(btrim(av.value_text))),to_jsonb(av.value_boolean),
          jsonb_build_array(av.value_number*coalesce(u.factor_to_base,1),
            case when u.factor_to_base is null then av.unit_id::text else u.unit_family end)))
        order by av.attribute_id,av.option_id) from public.variant_attribute_values av
        join public.attribute_definitions a on a.id=av.attribute_id and a.is_variant_axis and a.is_active
        left join public.units u on u.id=av.unit_id where av.variant_id=v.id) as signature
      from public.product_variants v where v.product_id=product and v.is_active
    ) select 1 from signatures where signature is not null group by signature having count(*)>1
  ) then errors=errors||jsonb_build_array('Variants: active SKUs must have distinct variant-axis combinations'); end if;
  return (select coalesce(jsonb_agg(distinct e),'[]'::jsonb) from jsonb_array_elements(errors) e);
end $$;

create or replace function private.recheck_publication() returns trigger
language plpgsql security definer set search_path='' as $$
declare errors jsonb;
begin
  if new.status='published' and (old.status<>'published' or new.primary_category_id is distinct from old.primary_category_id) then
    -- Ancestor rules cannot change concurrently with publication.
    perform 1 from public.categories where id in (with recursive ancestors as (
      select id,parent_id from public.categories where id=new.primary_category_id
      union all select c.id,c.parent_id from public.categories c join ancestors a on c.id=a.parent_id
    ) select id from ancestors) order by id for share;
    errors=private.publish_errors(new.id);
    if jsonb_array_length(errors)>0 then raise exception '%',errors::text using errcode='23514'; end if;
  end if;
  return new;
end $$;

-- Private legacy inquiries remain intact; DB checks now match application MFA.
drop policy inquiries_admin_select on public.inquiries;
drop policy inquiries_admin_update on public.inquiries;
create policy inquiries_admin_select on public.inquiries for select to authenticated
  using ((select private.current_role()) is not null);
create policy inquiries_admin_update on public.inquiries for update to authenticated
  using ((select private.current_role()) is not null) with check ((select private.current_role()) is not null);

revoke execute on function private.category_rules(uuid),private.publish_errors_baseline(uuid),
  private.publish_errors(uuid),private.category_parent_publication_guard() from public,anon,authenticated;
grant execute on function private.publish_errors(uuid) to authenticated;
revoke execute on function public.get_category_attribute_rules(uuid) from public,anon;
grant execute on function public.get_category_attribute_rules(uuid) to authenticated;
notify pgrst,'reload schema';
commit;


-- 20261101000200_atomic_authoring.sql SHA256 d97235ed279c0c9a6491d1d420b14f7a5e84e285719f0280d3ff30d07076e093
-- Preserve existing RPC signatures and permissions; strengthen direct-RPC validation.
begin;
create or replace function private.save_draft(payload jsonb) returns bigint language plpgsql security definer set search_path='' as $$
declare p public.products; item jsonb; v public.product_variants; pr public.variant_prices; result bigint;
begin
 perform private.require_role(array['super_admin','admin','editor']);
 if payload is null or jsonb_typeof(payload)<>'object' or payload->>'id' is null or payload->>'revision' is null
 or jsonb_typeof(payload->'product') is distinct from 'object'
 or jsonb_typeof(payload->'variants') is distinct from 'array' or jsonb_typeof(payload->'prices') is distinct from 'array'
 then raise exception 'Product, revision, variants and prices are required'; end if;
 if jsonb_array_length(payload->'variants')>100 or jsonb_array_length(payload->'prices')>500
 or (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(payload->'variants') x)
 or (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(payload->'prices') x)
 then raise exception 'Too many rows or duplicate row identities'; end if;
 if octet_length(payload::text)>524288 then raise exception 'Draft is too large'; end if;
 select * into p from public.products where id=(payload->>'id')::uuid for update;
 if p.id is null then raise exception 'Product not found'; end if;
 if p.status<>'draft' or p.deleted_at is not null then raise exception 'Unpublish or restore this product before editing'; end if;
 if p.revision is distinct from (payload->>'revision')::bigint then raise exception 'This product changed. Reload before saving' using errcode='40001'; end if;
 update public.products set name=payload->'product'->>'name',product_code=payload->'product'->>'product_code',slug=payload->'product'->>'slug',primary_category_id=(payload->'product'->>'primary_category_id')::uuid,brand_id=(payload->'product'->>'brand_id')::uuid,product_type=coalesce(payload->'product'->>'product_type','physical'),short_description=payload->'product'->>'short_description',description=payload->'product'->>'description',country_of_origin=payload->'product'->>'country_of_origin',is_featured=coalesce((payload->'product'->>'is_featured')::boolean,false),is_new_arrival=coalesce((payload->'product'->>'is_new_arrival')::boolean,false),seo_title=payload->'product'->>'seo_title',seo_description=payload->'product'->>'seo_description',key_features=coalesce(payload->'product'->'key_features',key_features),sort_order=coalesce((payload->'product'->>'sort_order')::integer,sort_order),updated_by=auth.uid(),revision=revision+1 where id=p.id returning revision into result;
 -- Existing variants are never hard deleted: historic prices retain their owner.
 if exists(select 1 from public.product_variants x where x.product_id=p.id and not exists(select 1 from jsonb_array_elements(payload->'variants') a where (a->>'id')::uuid=x.id)) then raise exception 'Deactivate existing variants instead of removing them'; end if;
 update public.product_variants set is_default=false where product_id=p.id;
 for item in select value from jsonb_array_elements(payload->'variants') loop
 v=jsonb_populate_record(null::public.product_variants,item);
 if exists(select 1 from public.product_variants where id=v.id and product_id<>p.id) then raise exception 'Foreign variant'; end if;
 insert into public.product_variants(id,product_id,sku,variant_name,model_number,manufacturer_part_number,sort_order,base_unit_id,minimum_order_qty,minimum_order_unit_id,monthly_supply_capacity,capacity_unit_id,lead_time_days,availability_status,is_default,is_active)
 values(v.id,p.id,v.sku,v.variant_name,v.model_number,v.manufacturer_part_number,coalesce(v.sort_order,0),v.base_unit_id,v.minimum_order_qty,v.minimum_order_unit_id,v.monthly_supply_capacity,v.capacity_unit_id,v.lead_time_days,v.availability_status,v.is_default,v.is_active)
 on conflict(id) do update set sku=excluded.sku,variant_name=excluded.variant_name,model_number=excluded.model_number,manufacturer_part_number=case when item ? 'manufacturer_part_number' then excluded.manufacturer_part_number else public.product_variants.manufacturer_part_number end,sort_order=case when item ? 'sort_order' then excluded.sort_order else public.product_variants.sort_order end,base_unit_id=excluded.base_unit_id,minimum_order_qty=excluded.minimum_order_qty,minimum_order_unit_id=excluded.minimum_order_unit_id,monthly_supply_capacity=excluded.monthly_supply_capacity,capacity_unit_id=excluded.capacity_unit_id,lead_time_days=excluded.lead_time_days,availability_status=excluded.availability_status,is_default=excluded.is_default,is_active=excluded.is_active;
 end loop;
 -- Verify the complete price history contract before changing active states.
 for item in select value from jsonb_array_elements(payload->'prices') loop
 pr=jsonb_populate_record(null::public.variant_prices,item);
 if not exists(select 1 from public.product_variants where id=pr.variant_id and product_id=p.id) then raise exception 'Foreign price variant'; end if;
 if exists(select 1 from public.variant_prices where id=pr.id) and not exists(select 1 from public.variant_prices
 where id=pr.id and variant_id=pr.variant_id and currency_code=pr.currency_code and price_type=pr.price_type
 and min_price is not distinct from pr.min_price and max_price is not distinct from pr.max_price
 and price_unit_id=pr.price_unit_id and trade_term=pr.trade_term and valid_from=pr.valid_from
 and valid_until is not distinct from pr.valid_until) then raise exception 'Append a replacement price instead of changing history'; end if;
 end loop;
 update public.variant_prices stored set is_active=false from jsonb_to_recordset(payload->'prices') as x(id uuid,is_active boolean)
 where stored.id=x.id and x.is_active=false;
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

create or replace function private.lifecycle(product uuid,expected_revision bigint,operation text) returns bigint language plpgsql security definer set search_path='' as $$
declare p public.products; errors jsonb; result bigint;
begin
 perform private.require_role(array['super_admin','admin']);
 select * into p from public.products where id=product for update;
 if p.id is null then raise exception 'Product not found'; end if;
 if p.revision is distinct from expected_revision then raise exception 'This product changed. Reload before continuing' using errcode='40001'; end if;
 if operation is null or operation not in ('publish','unpublish','archive','delete','restore') then raise exception 'Unknown operation'; end if;
 if operation='publish' then
 if p.deleted_at is not null or p.status<>'draft' then raise exception 'Only an undeleted draft can publish'; end if;
 errors=private.publish_errors(product);if jsonb_array_length(errors)>0 then raise exception '%',errors::text using errcode='23514';end if;
 end if;
 update public.products set status=case when operation='publish' then 'published' when operation in ('unpublish','restore') then 'draft' else 'archived' end,deleted_at=case when operation='delete' then now() when operation='restore' then null else deleted_at end,published_at=case when operation='publish' then now() else published_at end,updated_by=auth.uid(),revision=revision+1 where id=product returning revision into result;
 insert into private.outbox_events(entity_id,event_type,revision) values(product,'catalog.'||operation,result);
 return result;
end $$;

create or replace function private.integration_actor(actor uuid,product uuid,expected_revision bigint) returns void language plpgsql set search_path='' as $$
declare p public.products;
begin
 if not exists(select 1 from public.admin_profiles where id=actor and is_active and role in ('super_admin','admin','editor')) then raise exception 'Inactive actor' using errcode='42501';end if;
 select * into p from public.products where id=product for update;
 if p.id is null or p.status<>'draft' or p.deleted_at is not null then raise exception 'An undeleted draft is required';end if;
 if p.revision is distinct from expected_revision then raise exception 'Product changed; reload' using errcode='40001';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
end $$;
notify pgrst,'reload schema';
commit;


-- 20261101000300_document_lifecycle.sql SHA256 ce4ac8d5687b05a6c24d93ed6520cab48e085e4e154bbc6eb43e8871c5479b7c
-- Retire documents without destroying source files or certification history.
begin;
alter table public.product_documents add column retired_at timestamptz;

create function public.product_document_action(product uuid,expected_revision bigint,document uuid,
  operation text,title_text text default null,visible boolean default null,variant uuid default null)
returns bigint language plpgsql security definer set search_path='' as $$
declare d public.product_documents; result bigint;
begin
  perform private.require_role(array['super_admin','admin','editor']);
  perform private.integration_actor(auth.uid(),product,expected_revision);
  select * into d from public.product_documents where id=document and product_id=product and retired_at is null for update;
  if d.id is null then raise exception 'Document not found'; end if;
  if operation='retire' then
    if exists(select 1 from public.product_certifications where document_id=document) then
      raise exception 'Unlink this document from certifications before retiring it';
    end if;
    update public.product_documents set retired_at=now(),is_public=false where id=document;
  elsif operation='metadata' then
    if title_text is null or length(btrim(title_text)) not between 1 and 255 or visible is null then
      raise exception 'Document title and visibility are required';
    end if;
    if variant is not null and not exists(select 1 from public.product_variants where id=variant and product_id=product) then
      raise exception 'Foreign document variant';
    end if;
    update public.product_documents set title=btrim(title_text),is_public=visible,variant_id=variant where id=document;
  else raise exception 'Unknown document operation'; end if;
  update public.products set revision=revision+1,updated_by=auth.uid() where id=product returning revision into result;
  return result;
end $$;
revoke execute on function public.product_document_action(uuid,bigint,uuid,text,text,boolean,uuid) from public,anon;
grant execute on function public.product_document_action(uuid,bigint,uuid,text,text,boolean,uuid) to authenticated;

create or replace view public_catalog.documents with (security_barrier=true) as
select d.id,d.product_id,d.variant_id,d.title,d.document_type,
  d.file_extension,d.bytes,p.name as product_name,p.product_code,p.slug as product_slug,d.created_at
from public.product_documents d join public_catalog.visibility visible on visible.id=d.product_id
join public.products p on p.id=d.product_id
where d.is_public and d.retired_at is null and (d.variant_id is null or exists(
  select 1 from public.product_variants v where v.id=d.variant_id and v.is_active));
notify pgrst,'reload schema';
commit;


-- 20261101000400_public_catalog_discovery.sql SHA256 0744e65db32fd46595c84f248800b6ce11be618b638e794fd714e2d5ea8ba353
-- Narrow anonymous discovery; raw tables and private upload paths stay private.
begin;

create function private.specification_matches(attribute uuid,choice uuid,txt text,num numeric,
  flag boolean,unit uuid,filter jsonb) returns boolean
language sql stable set search_path='' as $$
  select coalesce(exists(select 1 from public.attribute_definitions a
    left join public.units du on du.id=a.default_unit_id
    left join public.units u on u.id=unit
    where a.id=attribute and a.id=(filter->>'attribute')::uuid and a.is_active and a.is_filterable
      and (case a.data_type
        when 'select' then choice=(filter->>'option')::uuid
        when 'multi_select' then choice=(filter->>'option')::uuid
        when 'boolean' then flag=(filter->>'boolean')::boolean
        when 'text' then lower(txt)=lower(filter->>'text')
        when 'number' then
          (a.default_unit_id is null and unit is null or
            u.id=du.id or u.unit_family=du.unit_family and u.factor_to_base is not null and du.factor_to_base is not null)
          and (not filter ? 'min' or num*coalesce(u.factor_to_base/du.factor_to_base,1)>=(filter->>'min')::numeric)
          and (not filter ? 'max' or num*coalesce(u.factor_to_base/du.factor_to_base,1)<=(filter->>'max')::numeric)
        else false end)),false)
$$;

create function public_catalog.browse_product_cards(
  category_filter text default '',brand_filter text default '',search_query text default '',
  featured_only boolean default false,new_only boolean default false,
  page_number integer default 1,page_size integer default 12,
  sort_field text default 'updated_at',sort_ascending boolean default false,
  attribute_filters jsonb default '[]',after_cursor jsonb default null
) returns jsonb language plpgsql stable security definer set search_path=''
set statement_timeout='8s' as $$
declare field text; direction text; size integer; page integer; pattern text;
  f jsonb; result jsonb; cursor_value text; cursor_id uuid; cursor_rank integer;
begin
  field=case when sort_field in ('name','published_at','updated_at') then sort_field else 'updated_at' end;
  direction=case when coalesce(sort_ascending,false) then 'asc' else 'desc' end;
  size=least(24,greatest(1,coalesce(page_size,12)));
  page=least(10000,greatest(1,coalesce(page_number,1)));
  category_filter=left(coalesce(category_filter,''),180);
  brand_filter=left(coalesce(brand_filter,''),180);
  search_query=btrim(left(coalesce(search_query,''),80));
  pattern=replace(replace(replace(search_query,'\','\\'),'%','\%'),'_','\_');
  if jsonb_typeof(attribute_filters) is distinct from 'array' or jsonb_array_length(attribute_filters)>8 then
    raise exception 'Use at most eight technical filters' using errcode='22023';
  end if;
  for f in select value from jsonb_array_elements(attribute_filters) loop
    if jsonb_typeof(f) is distinct from 'object' or not f ? 'attribute' or (f->>'attribute')::uuid is null
      or not (f ? 'option' or f ? 'boolean' or f ? 'text' or f ? 'min' or f ? 'max')
      or (f ? 'option' and (f->>'option')::uuid is null)
      or (f ? 'boolean' and jsonb_typeof(f->'boolean') is distinct from 'boolean')
      or (f ? 'text' and (jsonb_typeof(f->'text') is distinct from 'string' or length(f->>'text') not between 1 and 100))
      or (f ? 'min' and (f->>'min' is null or f->>'min' !~ '^-?[0-9]{1,14}(\.[0-9]{1,4})?$'))
      or (f ? 'max' and (f->>'max' is null or f->>'max' !~ '^-?[0-9]{1,14}(\.[0-9]{1,4})?$'))
      or (f ? 'min' and f ? 'max' and (f->>'min')::numeric>(f->>'max')::numeric)
    then raise exception 'Invalid technical filter' using errcode='22023'; end if;
  end loop;
  if after_cursor is not null then
    if jsonb_typeof(after_cursor) is distinct from 'object' or after_cursor->>'sort' is distinct from field
      or after_cursor->>'direction' is distinct from direction or after_cursor->>'value' is null
      or after_cursor->>'id' is null or after_cursor->>'rank' is null then
      raise exception 'Invalid catalog cursor' using errcode='22023';
    end if;
    cursor_id=(after_cursor->>'id')::uuid;
    cursor_value=left(after_cursor->>'value',300);
    cursor_rank=(after_cursor->>'rank')::integer;
  end if;
  execute format($query$
    with recursive selected_categories as (
      select c.id,1 as depth from public.categories c where c.slug=$1 and c.is_active
      union all select c.id,sc.depth+1 from public.categories c join selected_categories sc on c.parent_id=sc.id
        where c.is_active and sc.depth<8
    ), search_matches as materialized (
      select id,min(rank) as rank from (
        select p.id,case when lower(p.product_code)=lower($3) then 0
          when p.product_code ilike $10||'%%' then 2 else 4 end as rank
        from public.products p where $3<>'' and (p.search_vector @@ websearch_to_tsquery('simple',$3)
          or p.name ilike '%%'||$10||'%%' or p.product_code ilike '%%'||$10||'%%'
          or p.short_description ilike '%%'||$10||'%%')
        union all
        select v.product_id,case when lower(v.sku)=lower($3) or lower(v.model_number)=lower($3)
            or lower(v.manufacturer_part_number)=lower($3) then 1
          when v.sku ilike $10||'%%' or v.model_number ilike $10||'%%' or v.manufacturer_part_number ilike $10||'%%' then 3 else 5 end
        from public.product_variants v where $3<>'' and v.is_active and
          (v.sku ilike '%%'||$10||'%%' or v.model_number ilike '%%'||$10||'%%' or v.manufacturer_part_number ilike '%%'||$10||'%%')
      ) matches group by id
    ), selected as materialized (
      select p.id,p.%1$I as sort_value,%7$s as rank
      from public.products p
      join public.categories c on c.id=p.primary_category_id and c.is_active
      left join public.brands b on b.id=p.brand_id and b.is_active
      left join search_matches sm on sm.id=p.id
      where p.status='published' and p.deleted_at is null
        and ($1='' or p.primary_category_id in (select id from selected_categories)
          or p.id in (select ec.product_id from public.product_extra_categories ec
            where ec.category_id in (select id from selected_categories)))
        and ($2='' or b.slug=$2) and ($3='' or sm.id is not null)
        and (not $4 or p.is_featured) and (not $5 or p.is_new_arrival)
        and (jsonb_array_length($8)=0 or exists(select 1 from public.product_variants v
          where v.product_id=p.id and v.is_active and not exists(
            select 1 from jsonb_array_elements($8) f where not (
              exists(select 1 from public.product_attribute_values av where av.product_id=p.id
                and private.specification_matches(av.attribute_id,av.option_id,av.value_text,av.value_number,av.value_boolean,av.unit_id,f))
              or exists(select 1 from public.variant_attribute_values av where av.variant_id=v.id
                and private.specification_matches(av.attribute_id,av.option_id,av.value_text,av.value_number,av.value_boolean,av.unit_id,f))
            ))))
        and ($9::uuid is null or %7$s>$12 or
          %7$s=$12 and (p.%1$I %3$s $11::%4$s or p.%1$I=$11::%4$s and p.id>$9))
      order by %7$s,p.%1$I %2$s,p.id limit $6 offset $7
    ), cards as materialized (
      select card.*,s.rank,s.sort_value from selected s cross join lateral (
        select c.* from public_catalog.product_cards c where c.id=s.id offset 0
      ) card order by s.rank,s.sort_value %2$s,s.id
    ) select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(card)-'rank'-'sort_value'
        order by card.rank,card.sort_value %2$s,card.id) from cards card),'[]'::jsonb),
      'next_cursor',(select jsonb_build_object('id',s.id,'value',s.sort_value,'rank',s.rank,'sort',%5$L,'direction',%6$L)
        from selected s order by s.rank,s.sort_value %2$s,s.id offset $6-2 limit 1))
  $query$,field,direction,case when direction='asc' then '>' else '<' end,
    case when field='name' then 'text' else 'timestamptz' end,field,direction,
    case when search_query='' then '0::integer' else 'coalesce(sm.rank,0)' end)
  into result using category_filter,brand_filter,search_query,coalesce(featured_only,false),coalesce(new_only,false),
    size+1,case when cursor_id is null then (page-1)*size else 0 end,attribute_filters,cursor_id,pattern,cursor_value,cursor_rank;
  return result;
end $$;

-- Preserve the existing nine-argument RPC and its pageSize+1 contract.
create or replace function public_catalog.list_product_cards(
  category_filter text default '',brand_filter text default '',search_query text default '',
  featured_only boolean default false,new_only boolean default false,
  page_number integer default 1,page_size integer default 12,
  sort_field text default 'updated_at',sort_ascending boolean default false
) returns setof public_catalog.product_cards
language sql stable security invoker set search_path='' as $$
  select * from jsonb_populate_recordset(null::public_catalog.product_cards,
    public_catalog.browse_product_cards(category_filter,brand_filter,search_query,featured_only,new_only,
      page_number,page_size,sort_field,sort_ascending)->'rows')
$$;

create function public_catalog.category_filters(category_filter text default '') returns jsonb
language sql stable security definer set search_path='' set statement_timeout='8s' as $$
  with rules as (
    select distinct r.attribute_id from public.categories c
    cross join lateral private.category_rules(c.id) r
    where c.is_active and (coalesce(category_filter,'')='' or c.slug=left(category_filter,180))
  ), attributes as (
    select a.id,a.code,a.name,a.data_type,u.symbol as unit,
      case when a.data_type in ('select','multi_select') then coalesce((select jsonb_agg(to_jsonb(o)) from (
        select o.id,o.label from public.attribute_options o where o.attribute_id=a.id and o.is_active
        order by o.sort_order,o.label,o.id limit 100) o),'[]'::jsonb) else '[]'::jsonb end as options
    from public.attribute_definitions a join rules r on r.attribute_id=a.id
    left join public.units u on u.id=a.default_unit_id
    where a.is_active and a.is_filterable order by a.sort_order,a.name,a.id limit 32
  ) select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) from attributes a
$$;

-- Product specs were absent from the existing detail projection. Append safe,
-- typed values, plus composition and equipment fit, without exposing raw rows.
create view public_catalog.product_specifications with (security_barrier=true) as
select av.product_id,a.code,a.name as label,av.value_text as text,av.value_number::text as number,
  av.value_boolean as boolean,o.label as option,u.symbol as unit,a.sort_order
from public.product_attribute_values av join public_catalog.visibility p on p.id=av.product_id
join public.attribute_definitions a on a.id=av.attribute_id and a.is_active
left join public.attribute_options o on o.id=av.option_id and o.is_active
left join public.units u on u.id=av.unit_id
where av.option_id is null or o.id is not null;

create or replace view public_catalog.product_details with (security_barrier=true) as
select p.slug,to_jsonb(p)||jsonb_build_object('key_features',(select key_features from public.products where id=p.id),'specifications',coalesce((select jsonb_agg(
  to_jsonb(s)-'product_id'-'sort_order' order by s.sort_order,s.code)
  from public_catalog.product_specifications s where s.product_id=p.id),'[]'::jsonb)) as product,
  coalesce((select jsonb_agg(to_jsonb(v)||jsonb_build_object('packaging',
    coalesce((select jsonb_agg(jsonb_build_object('type',pkg.packaging_type,'quantity',pkg.pack_quantity::text,
      'unit',u.symbol,'description',pkg.package_description) order by pkg.is_default desc,pkg.id)
      from public.variant_packaging pkg join public.units u on u.id=pkg.pack_unit_id where pkg.variant_id=v.id),'[]'::jsonb),
    'composition',coalesce((select jsonb_agg(jsonb_build_object('fiber',f.name,'percentage',fc.percentage::text) order by f.name)
      from public.variant_fiber_composition fc join public.fibers f on f.id=fc.fiber_id and f.is_active where fc.variant_id=v.id),'[]'::jsonb),
    'equipment',coalesce((select jsonb_agg(jsonb_build_object('brand',b.name,'model',e.model_name,'notes',ec.compatibility_notes) order by b.name,e.model_name)
      from public.variant_equipment_compatibility ec join public.equipment_models e on e.id=ec.equipment_model_id
      join public.brands b on b.id=e.brand_id and b.is_active where ec.variant_id=v.id),'[]'::jsonb)) order by v.is_default desc,v.sku,v.id)
    from (select * from public_catalog.variants where product_id=p.id order by is_default desc,sku,id limit 100) v),'[]'::jsonb) as variants,
  coalesce((select jsonb_agg(to_jsonb(d) order by d.title,d.id) from (
    select * from public_catalog.documents where product_id=p.id order by title,id limit 100) d),'[]'::jsonb) as documents,
  coalesce((select jsonb_agg(jsonb_build_object('kind','detail','url',coalesce(image.detail->>'url',image.delivery_url),
    'key',coalesce(image.detail->>'key',''),'width',coalesce((image.detail->>'width')::integer,800),
    'height',coalesce((image.detail->>'height')::integer,800)) order by image.is_primary desc,image.sort_order,image.id)
    from (select m.id,m.is_primary,m.sort_order,m.delivery_url,
      (select e from jsonb_array_elements(m.object_manifest) e where e->>'kind'='detail' limit 1) as detail
      from public.product_media m where m.product_id=p.id and m.upload_status='ready' and m.retired_at is null
        and m.media_type='image' and (m.variant_id is null or exists(select 1 from public.product_variants v where v.id=m.variant_id and v.is_active))
      order by m.is_primary desc,m.sort_order,m.id limit 100) image
    where coalesce(image.detail->>'url',image.delivery_url) is not null),'[]'::jsonb) as gallery
from public_catalog.products p;

revoke execute on function private.specification_matches(uuid,uuid,text,numeric,boolean,uuid,jsonb) from public,anon,authenticated;
revoke execute on function public_catalog.browse_product_cards(text,text,text,boolean,boolean,integer,integer,text,boolean,jsonb,jsonb),
  public_catalog.category_filters(text) from public;
grant execute on function public_catalog.browse_product_cards(text,text,text,boolean,boolean,integer,integer,text,boolean,jsonb,jsonb),
  public_catalog.category_filters(text) to anon,authenticated;
grant select on public_catalog.product_specifications to anon,authenticated;
revoke insert,update,delete,truncate,references,trigger on public_catalog.product_specifications from anon,authenticated;
notify pgrst,'reload schema';
commit;


-- 20261101000500_commercial_history.sql SHA256 393c2c6b336d0159f3164164024cb6e78eb9918a8371a5e3b462f5595e8212f3
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


-- 20261101000600_atomic_duplication.sql SHA256 2a32b2881c6b3b7b80cceec9fbaa660581a04a9bf9d10561dc36b4d5eb4118f6
begin;
create function public.duplicate_catalog_product(product uuid,expected_revision bigint) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.products; target uuid=gen_random_uuid(); suffix text=substr(replace(target::text,'-',''),1,12);
  variants jsonb; prices jsonb;
begin
  perform private.require_role(array['super_admin','admin','editor']);
  select * into p from public.products where id=product and deleted_at is null for share;
  if p.id is null then raise exception 'Source product not found'; end if;
  if p.revision is distinct from expected_revision then raise exception 'Source product changed; reload' using errcode='40001'; end if;
  if (select count(*) from public.product_variants where product_id=product)>100 or
    (select count(*) from public.variant_prices pr join public.product_variants v on v.id=pr.variant_id where v.product_id=product)>500 then
    raise exception 'Source exceeds the supported editor limits';
  end if;
  select coalesce(jsonb_object_agg(v.id,gen_random_uuid()),'{}') into variants from public.product_variants v where v.product_id=product;
  select coalesce(jsonb_object_agg(pr.id,gen_random_uuid()),'{}') into prices from public.variant_prices pr
    join public.product_variants v on v.id=pr.variant_id where v.product_id=product and pr.is_active
      and (pr.valid_until is null or pr.valid_until>now());
  insert into public.products(id,name,product_code,slug,product_type,primary_category_id,brand_id,country_of_origin,
    short_description,description,key_features,seo_title,seo_description,status,created_by,updated_by,sort_order)
  values(target,left(p.name,248)||' (Copy)',left(p.product_code,61)||'-COPY-'||suffix,left(p.slug,261)||'-copy-'||suffix,
    p.product_type,p.primary_category_id,p.brand_id,p.country_of_origin,p.short_description,p.description,p.key_features,
    p.seo_title,p.seo_description,'draft',auth.uid(),auth.uid(),p.sort_order);
  insert into public.product_variants(id,product_id,sku,variant_name,model_number,manufacturer_part_number,
    base_unit_id,minimum_order_qty,minimum_order_unit_id,monthly_supply_capacity,capacity_unit_id,lead_time_days,
    availability_status,is_default,is_active,sort_order)
  select (variants->>v.id::text)::uuid,target,left(v.sku,81)||'-COPY-'||substr(replace(variants->>v.id::text,'-',''),1,12),v.variant_name,v.model_number,v.manufacturer_part_number,
    v.base_unit_id,v.minimum_order_qty,v.minimum_order_unit_id,v.monthly_supply_capacity,v.capacity_unit_id,v.lead_time_days,
    v.availability_status,v.is_default,v.is_active,v.sort_order from public.product_variants v where v.product_id=product;
  insert into public.variant_prices(id,variant_id,currency_code,price_type,min_price,max_price,price_unit_id,trade_term,valid_from,valid_until,is_active)
  select (prices->>pr.id::text)::uuid,(variants->>pr.variant_id::text)::uuid,pr.currency_code,pr.price_type,pr.min_price,pr.max_price,
    pr.price_unit_id,pr.trade_term,pr.valid_from,pr.valid_until,true from public.variant_prices pr where prices ? pr.id::text;
  insert into public.price_tiers(variant_price_id,min_quantity,max_quantity,quantity_unit_id,unit_price,sort_order)
  select (prices->>t.variant_price_id::text)::uuid,t.min_quantity,t.max_quantity,t.quantity_unit_id,t.unit_price,t.sort_order
    from public.price_tiers t where prices ? t.variant_price_id::text;
  insert into public.product_attribute_values(product_id,attribute_id,option_id,value_text,value_number,value_boolean,unit_id)
  select target,a.attribute_id,a.option_id,a.value_text,a.value_number,a.value_boolean,a.unit_id from public.product_attribute_values a where a.product_id=product;
  insert into public.variant_attribute_values(variant_id,attribute_id,option_id,value_text,value_number,value_boolean,unit_id)
  select (variants->>a.variant_id::text)::uuid,a.attribute_id,a.option_id,a.value_text,a.value_number,a.value_boolean,a.unit_id
    from public.variant_attribute_values a where variants ? a.variant_id::text;
  insert into public.variant_packaging(variant_id,packaging_type,pack_quantity,pack_unit_id,package_description,is_default)
  select (variants->>a.variant_id::text)::uuid,a.packaging_type,a.pack_quantity,a.pack_unit_id,a.package_description,a.is_default
    from public.variant_packaging a where variants ? a.variant_id::text;
  insert into public.variant_fiber_composition(variant_id,fiber_id,percentage)
  select (variants->>a.variant_id::text)::uuid,a.fiber_id,a.percentage from public.variant_fiber_composition a where variants ? a.variant_id::text;
  insert into public.variant_equipment_compatibility(variant_id,equipment_model_id,compatibility_notes)
  select (variants->>a.variant_id::text)::uuid,a.equipment_model_id,a.compatibility_notes
    from public.variant_equipment_compatibility a where variants ? a.variant_id::text;
  insert into public.product_extra_categories(product_id,category_id) select target,category_id from public.product_extra_categories where product_id=product;
  insert into public.product_industries(product_id,industry_id) select target,industry_id from public.product_industries where product_id=product;
  insert into public.product_applications(product_id,application_id) select target,application_id from public.product_applications where product_id=product;
  -- Upload ownership and certification evidence belong to the source identity.
  -- They must be independently attached/reviewed on the new draft.
  return target;
end $$;
revoke execute on function public.duplicate_catalog_product(uuid,bigint) from public,anon;
grant execute on function public.duplicate_catalog_product(uuid,bigint) to authenticated;
notify pgrst,'reload schema';
commit;


-- 20261101000700_asset_assignment_and_dictionary_guards.sql SHA256 01091bc54ba4c307cebc468a851f4f538b84ade1afc358f614bc300702ca1a9c
begin;
create or replace function private.media_action(product uuid,expected_revision bigint,media uuid,operation text,alt text) returns bigint
language plpgsql security definer set search_path='' as $$
declare m public.product_media; result bigint; target_variant uuid;
begin
  perform private.require_role(array['super_admin','admin','editor']);
  perform private.integration_actor(auth.uid(),product,expected_revision);
  select * into m from public.product_media where id=media and product_id=product and retired_at is null for update;
  if m.id is null then raise exception 'Image not found'; end if;
  if operation='primary' and m.upload_status='ready' then
    update public.product_media set is_primary=false where product_id=product;
    update public.product_media set is_primary=true where id=media;
  elsif operation='alt' then update public.product_media set alt_text=left(alt,255) where id=media;
  elsif operation='detach' then
    update public.product_media set upload_status='retired',retired_at=now(),is_primary=false,verification_token=null,verification_lease_until=null where id=media;
  elsif operation='order' and alt ~ '^[0-9]{1,6}$' then update public.product_media set sort_order=alt::integer where id=media;
  elsif operation='variant' and m.upload_status='ready' then
    target_variant=nullif(alt,'')::uuid;
    if target_variant is not null and not exists(select 1 from public.product_variants where id=target_variant and product_id=product)
    then raise exception 'Foreign image variant'; end if;
    update public.product_media set variant_id=target_variant where id=media;
  else raise exception 'Invalid media action'; end if;
  update public.products set revision=revision+1,updated_by=auth.uid() where id=product returning revision into result;
  if operation='detach' then insert into private.outbox_events(entity_id,event_type,revision,payload,available_at)
    values(media,'image.retired',result,jsonb_build_object('media_id',media,'provider',m.provider,'asset_id',m.provider_asset_id),
      greatest(now(),coalesce(m.upload_expires_at+interval '10 minutes',now()))); end if;
  return result;
end $$;

create function private.specification_dictionary_guard() returns trigger language plpgsql set search_path='' as $$
declare definition uuid;
begin
  if tg_table_name='attribute_definitions' then
    definition=new.id;
  else
    definition=new.attribute_id;
    perform 1 from public.attribute_definitions where id=definition for update;
    if (new.attribute_id,new.value) is distinct from (old.attribute_id,old.value) and (
      exists(select 1 from public.product_attribute_values where option_id=old.id) or
      exists(select 1 from public.variant_attribute_values where option_id=old.id)) then
      raise exception 'Referenced option identity is immutable; create another option';
    end if;
  end if;
  if old.is_active and not new.is_active and (
    exists(select 1 from public.product_attribute_values av join public.products p on p.id=av.product_id
      where av.attribute_id=definition and (tg_table_name='attribute_definitions' or av.option_id=new.id)
        and p.status='published' and p.deleted_at is null) or
    exists(select 1 from public.variant_attribute_values av join public.product_variants v on v.id=av.variant_id
      join public.products p on p.id=v.product_id where av.attribute_id=definition
        and (tg_table_name='attribute_definitions' or av.option_id=new.id) and v.is_active
        and p.status='published' and p.deleted_at is null))
  then raise exception 'Unpublish affected products before disabling their specifications'; end if;
  return new;
end $$;
create trigger specification_dictionary_guard before update on public.attribute_definitions
  for each row execute function private.specification_dictionary_guard();
create trigger specification_option_guard before update on public.attribute_options
  for each row execute function private.specification_dictionary_guard();
revoke execute on function private.specification_dictionary_guard() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;


-- 20261101000800_measured_catalog_name_index.sql SHA256 f99bbd82f6c6831f603b98953d35578b4d717418345fc3cb2f0ae17d7e4c9050
-- Evidence: docs/production-refinement/performance-index-comparison.json.
-- 5,000 products, same fixture/transaction: technical filter P95 159.19 ->
-- 6.56 ms; actual inner plan 102.099 -> 2.351 ms and uses this index shape.
-- Existing status/updated_at and FK/GIN indexes are retained.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
create index products_published_name_id on public.products(name,id)
  where status='published' and deleted_at is null;
commit;


-- 20261101000900_detail_visibility_plan.sql SHA256 d03036b77e5ae756e8ca364f5cd2f1926d30f9313acc547e156e70d86688c45d
-- EXPLAIN at 50,000 products showed a redundant visibility join scanning the
-- entire published catalog for one unique slug. Keep the exact public predicate
-- inline so the existing products_slug_key can serve a single-product detail.
begin;
create or replace view public_catalog.products with (security_barrier=true) as
select p.id,p.name,p.slug,p.product_code,p.short_description,p.description,
  p.product_type,p.country_of_origin,p.is_featured,p.is_new_arrival,
  p.seo_title,p.seo_description,p.published_at,p.updated_at,
  c.name as category_name,c.slug as category_slug,b.name as brand_name,
  media.delivery_url as image_url,coalesce(media.images,'[]'::jsonb) as image_variants,
  media.image_key
from public.products p
join public.categories c on c.id=p.primary_category_id and c.is_active
left join public.brands b on b.id=p.brand_id and b.is_active
left join lateral (
  select m.delivery_url,
    (select jsonb_agg(jsonb_build_object('kind',e->>'kind','url',e->>'url',
      'width',(e->>'width')::integer,'height',(e->>'height')::integer,'key',e->>'key'))
      from jsonb_array_elements(m.object_manifest) e
      where e->>'kind' in ('thumbnail','card','detail')) as images,
    (select e->>'key' from jsonb_array_elements(m.object_manifest) e
      where e->>'kind'='detail' limit 1) as image_key
  from public.product_media m where m.product_id=p.id and m.upload_status='ready'
    and m.retired_at is null and m.media_type='image'
    and (m.variant_id is null or exists(select 1 from public.product_variants v
      where v.id=m.variant_id and v.is_active))
  order by m.is_primary desc,m.sort_order,m.id limit 1
) media on true
where p.status='published' and p.deleted_at is null;
notify pgrst,'reload schema';
commit;


-- 20261101001000_finite_catalog_numbers.sql SHA256 ccebcc208edf54769ec326256bf31ef91543db89ef7edb33f9c73f0bd157ed40
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
-- PostgreSQL NUMERIC NaN compares greater than finite numbers and can pass > 0.
-- Preserve data: validation fails the entire migration if an existing value
-- needs operator review. Never coerce financial or technical values silently.
do $$
declare field record; constraint_name text;
begin
  for field in
    select c.table_name,c.column_name
    from information_schema.columns c
    join information_schema.tables t using(table_catalog,table_schema,table_name)
    where c.table_schema='public' and c.data_type='numeric' and t.table_type='BASE TABLE'
    order by c.table_name,c.ordinal_position
  loop
    constraint_name='finite_'||field.column_name;
    execute format('alter table public.%I add constraint %I check (%I not in (''NaN''::numeric,''Infinity''::numeric,''-Infinity''::numeric)) not valid',
      field.table_name,constraint_name,field.column_name);
    execute format('alter table public.%I validate constraint %I',field.table_name,constraint_name);
  end loop;
end $$;
commit;


-- 20261101001100_publication_dictionary_serialization.sql SHA256 d8fd498c3d21762a9b0a6a3196ae752ad2957e03b52e3a8f57a67d77506327aa
begin;
-- Row locks serialize specification edits with the final publication check.
-- Option updates already lock their parent definition, so lock options first.
create or replace function private.recheck_publication() returns trigger
language plpgsql security definer set search_path='' as $$
declare errors jsonb;
begin
  if new.status='published' and (old.status<>'published' or new.primary_category_id is distinct from old.primary_category_id) then
    perform 1 from public.categories where id in (with recursive ancestors as (
      select id,parent_id from public.categories where id=new.primary_category_id
      union all select c.id,c.parent_id from public.categories c join ancestors a on c.id=a.parent_id
    ) select id from ancestors) order by id for share;
    perform 1 from public.attribute_options where id in (
      select av.option_id from public.product_attribute_values av where av.product_id=new.id
      union select av.option_id from public.variant_attribute_values av
        join public.product_variants v on v.id=av.variant_id where v.product_id=new.id and v.is_active
    ) order by id for share;
    perform 1 from public.attribute_definitions where id in (
      select cr.attribute_id from private.category_rules(new.primary_category_id) cr
      union select av.attribute_id from public.product_attribute_values av where av.product_id=new.id
      union select av.attribute_id from public.variant_attribute_values av
        join public.product_variants v on v.id=av.variant_id where v.product_id=new.id and v.is_active
    ) order by id for share;
    errors=private.publish_errors(new.id);
    if jsonb_array_length(errors)>0 then raise exception '%',errors::text using errcode='23514'; end if;
  end if;
  return new;
end $$;

-- Even an optional rule without stored values participates in publication.
-- Disabling it or introducing an axis must not invalidate published products.
create function private.mapped_attribute_publication_guard() returns trigger
language plpgsql set search_path='' as $$
begin
  if ((old.is_active and not new.is_active) or
      (new.data_type,new.default_unit_id,new.is_variant_axis) is distinct from
      (old.data_type,old.default_unit_id,old.is_variant_axis)) and exists (
    with recursive affected_categories as (
      select ca.category_id as id from public.category_attributes ca where ca.attribute_id=old.id
      union select c.id from public.categories c join affected_categories a on c.parent_id=a.id
    ) select 1 from public.products p join affected_categories a on a.id=p.primary_category_id
      where p.status='published' and p.deleted_at is null
  ) then raise exception 'Unpublish affected products before changing mapped specification semantics'; end if;
  return new;
end $$;
create trigger attribute_mapped_publication_guard before update on public.attribute_definitions
  for each row execute function private.mapped_attribute_publication_guard();
revoke execute on function private.recheck_publication(),private.mapped_attribute_publication_guard()
  from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
