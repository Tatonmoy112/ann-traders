begin;
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
commit;
