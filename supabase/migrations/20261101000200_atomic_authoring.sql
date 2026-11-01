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
