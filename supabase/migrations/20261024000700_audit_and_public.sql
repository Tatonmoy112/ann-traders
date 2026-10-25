begin;
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
commit;
