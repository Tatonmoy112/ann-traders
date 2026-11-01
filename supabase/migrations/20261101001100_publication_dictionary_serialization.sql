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
