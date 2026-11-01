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
