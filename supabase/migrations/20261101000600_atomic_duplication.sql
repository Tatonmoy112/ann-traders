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
