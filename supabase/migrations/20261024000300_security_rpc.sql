begin;
create function private.current_role() returns text language sql stable security definer set search_path='' as $$ select role from public.admin_profiles where id=auth.uid() and is_active $$;
create function private.require_role(allowed text[]) returns void language plpgsql stable security definer set search_path='' as $$ begin if not coalesce(private.current_role()=any(allowed),false) then raise exception 'Access denied' using errcode='42501'; end if; end $$;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;
revoke all on all tables in schema public from anon,authenticated;
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function private.current_role(),private.require_role(text[]) to authenticated;

-- No direct writes to aggregate tables: authenticated guarded RPCs own transactions.
do $$ declare r record; begin
 for r in select tablename from pg_tables where schemaname='public' loop
 execute format('alter table public.%I enable row level security',r.tablename);
 execute format('grant select on public.%I to authenticated',r.tablename);
 if r.tablename='admin_profiles' then
 execute 'create policy admin_read on public.admin_profiles for select to authenticated using (id=auth.uid() or private.current_role()=''super_admin'')';
 elsif r.tablename='audit_logs' then
 execute 'create policy audit_read on public.audit_logs for select to authenticated using(private.current_role() in (''super_admin'',''admin''))';
 else
 execute format('create policy active_admin_read on public.%I for select to authenticated using(private.current_role() is not null)',r.tablename);
 end if;
 end loop;
end $$;
do $$ declare t text; begin
 foreach t in array array['categories','brands','units','attribute_definitions','attribute_options','category_attributes','industries','applications','certifications','fibers','equipment_models'] loop
 execute format('grant insert,update on public.%I to authenticated',t);
 execute format('create policy master_insert on public.%I for insert to authenticated with check(private.current_role() in (''super_admin'',''admin''))',t);
 execute format('create policy master_update on public.%I for update to authenticated using(private.current_role() in (''super_admin'',''admin'')) with check(private.current_role() in (''super_admin'',''admin''))',t);
 end loop;
end $$;
create function private.audit_write() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid=auth.uid(); data jsonb;
begin
 if actor is not null then
 data=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 insert into public.audit_logs(admin_id,entity_name,entity_id,action,old_data,new_data)
 values(actor,tg_table_name,coalesce((data->>'id')::uuid,(data->>'product_id')::uuid,(data->>'variant_id')::uuid),lower(tg_op),case when tg_op<>'INSERT' then to_jsonb(old)-'storage_path' end,case when tg_op<>'DELETE' then to_jsonb(new)-'storage_path' end);
 end if;
 return coalesce(new,old);
end $$;
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='public' and tablename<>'audit_logs' loop
 execute format('create trigger touch_updated before update on public.%I for each row execute function private.touch()',t);
 execute format('create trigger audit_write after insert or update or delete on public.%I for each row execute function private.audit_write()',t);
 end loop;
end $$;

create function private.create_draft(p_name text,p_code text,p_slug text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform private.require_role(array['super_admin','admin','editor']);
 if length(trim(p_name))<2 or length(trim(p_code))<2 then raise exception 'Name and product code are required'; end if;
 insert into public.products(name,product_code,slug,product_type,status,created_by,updated_by) values(trim(p_name),trim(p_code),p_slug,'physical','draft',auth.uid(),auth.uid()) returning id into result;
 return result;
end $$;
create function public.create_product_draft(p_name text,p_code text,p_slug text) returns uuid language sql security invoker set search_path='' as $$ select private.create_draft(p_name,p_code,p_slug) $$;

create function private.save_draft(payload jsonb) returns bigint language plpgsql security definer set search_path='' as $$
declare p public.products; item jsonb; v public.product_variants; pr public.variant_prices; result bigint;
begin
 perform private.require_role(array['super_admin','admin','editor']);
 if octet_length(payload::text)>524288 then raise exception 'Draft is too large'; end if;
 select * into p from public.products where id=(payload->>'id')::uuid for update;
 if p.id is null then raise exception 'Product not found'; end if;
 if p.status<>'draft' or p.deleted_at is not null then raise exception 'Unpublish or restore this product before editing'; end if;
 if p.revision<>(payload->>'revision')::bigint then raise exception 'This product changed. Reload before saving' using errcode='40001'; end if;
 update public.products set name=payload->'product'->>'name',product_code=payload->'product'->>'product_code',slug=payload->'product'->>'slug',primary_category_id=(payload->'product'->>'primary_category_id')::uuid,brand_id=(payload->'product'->>'brand_id')::uuid,product_type=coalesce(payload->'product'->>'product_type','physical'),short_description=payload->'product'->>'short_description',description=payload->'product'->>'description',country_of_origin=payload->'product'->>'country_of_origin',is_featured=coalesce((payload->'product'->>'is_featured')::boolean,false),is_new_arrival=coalesce((payload->'product'->>'is_new_arrival')::boolean,false),seo_title=payload->'product'->>'seo_title',seo_description=payload->'product'->>'seo_description',updated_by=auth.uid(),revision=revision+1 where id=p.id returning revision into result;
 -- Existing variants are never hard deleted: historic prices retain their owner.
 if exists(select 1 from public.product_variants x where x.product_id=p.id and not exists(select 1 from jsonb_array_elements(payload->'variants') a where (a->>'id')::uuid=x.id)) then raise exception 'Deactivate existing variants instead of removing them'; end if;
 update public.product_variants set is_default=false where product_id=p.id;
 for item in select value from jsonb_array_elements(payload->'variants') loop
 v=jsonb_populate_record(null::public.product_variants,item);
 if exists(select 1 from public.product_variants where id=v.id and product_id<>p.id) then raise exception 'Foreign variant'; end if;
 insert into public.product_variants(id,product_id,sku,variant_name,model_number,base_unit_id,minimum_order_qty,minimum_order_unit_id,monthly_supply_capacity,capacity_unit_id,lead_time_days,availability_status,is_default,is_active)
 values(v.id,p.id,v.sku,v.variant_name,v.model_number,v.base_unit_id,v.minimum_order_qty,v.minimum_order_unit_id,v.monthly_supply_capacity,v.capacity_unit_id,v.lead_time_days,v.availability_status,v.is_default,v.is_active)
 on conflict(id) do update set sku=excluded.sku,variant_name=excluded.variant_name,model_number=excluded.model_number,base_unit_id=excluded.base_unit_id,minimum_order_qty=excluded.minimum_order_qty,minimum_order_unit_id=excluded.minimum_order_unit_id,monthly_supply_capacity=excluded.monthly_supply_capacity,capacity_unit_id=excluded.capacity_unit_id,lead_time_days=excluded.lead_time_days,availability_status=excluded.availability_status,is_default=excluded.is_default,is_active=excluded.is_active;
 end loop;
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
create function public.save_product_draft(payload jsonb) returns bigint language sql security invoker set search_path='' as $$ select private.save_draft(payload) $$;

create function private.publish_errors(product uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare errors jsonb='[]'; p public.products; v record; r record;
begin
 perform private.require_role(array['super_admin','admin','editor']);
 select * into p from public.products where id=product;
 if p.primary_category_id is null then errors=errors||jsonb_build_array('Basics: choose a primary category'); end if;
 if not exists(select 1 from public.categories where id=p.primary_category_id and is_active) then errors=errors||jsonb_build_array('Basics: category must be active'); end if;
 if not exists(select 1 from public.product_variants where product_id=product and is_active and is_default) then errors=errors||jsonb_build_array('Variants: choose exactly one active default'); end if;
 if not exists(select 1 from public.product_media where product_id=product and is_primary and upload_status='ready') then errors=errors||jsonb_build_array('Images: attach a verified primary image'); end if;
 for v in select * from public.product_variants where product_id=product and is_active loop
 if not exists(select 1 from public.variant_prices where variant_id=v.id and is_active and valid_from<=now() and (valid_until is null or valid_until>now())) then errors=errors||jsonb_build_array(v.sku||': add a current price or Price on request'); end if;
 if exists(select 1 from public.categories where id=p.primary_category_id and requires_composition) and coalesce((select sum(percentage) from public.variant_fiber_composition where variant_id=v.id),0)<>100 then errors=errors||jsonb_build_array(v.sku||': fiber composition must total 100%'); end if;
 end loop;
 for r in select ca.*,a.name from public.category_attributes ca join public.attribute_definitions a on a.id=ca.attribute_id where ca.category_id=p.primary_category_id and ca.is_required loop
 if r.applies_to='product' and not exists(select 1 from public.product_attribute_values where product_id=product and attribute_id=r.attribute_id) then errors=errors||jsonb_build_array('Specifications: required '||r.name); end if;
 if r.applies_to='variant' then
 for v in select * from public.product_variants where product_id=product and is_active loop
 if not exists(select 1 from public.variant_attribute_values where variant_id=v.id and attribute_id=r.attribute_id) then errors=errors||jsonb_build_array(v.sku||': required '||r.name); end if;
 end loop;
 end if;
 end loop;
 return errors;
end $$;
create function public.product_publish_errors(product uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.publish_errors(product) $$;

create table private.outbox_events(id uuid primary key default gen_random_uuid(),entity_id uuid not null,event_type text not null,revision bigint not null,payload jsonb not null default '{}',created_at timestamptz not null default now(),attempts integer not null default 0,available_at timestamptz not null default now(),completed_at timestamptz,unique(entity_id,event_type,revision));
create function private.lifecycle(product uuid,expected_revision bigint,operation text) returns bigint language plpgsql security definer set search_path='' as $$
declare p public.products; errors jsonb; result bigint;
begin
 perform private.require_role(array['super_admin','admin']);
 select * into p from public.products where id=product for update;
 if p.id is null then raise exception 'Product not found'; end if;
 if p.revision<>expected_revision then raise exception 'This product changed. Reload before continuing' using errcode='40001'; end if;
 if operation not in ('publish','unpublish','archive','delete','restore') then raise exception 'Unknown operation'; end if;
 if operation='publish' then
 if p.deleted_at is not null or p.status<>'draft' then raise exception 'Only an undeleted draft can publish'; end if;
 errors=private.publish_errors(product);if jsonb_array_length(errors)>0 then raise exception '%',errors::text using errcode='23514';end if;
 end if;
 update public.products set status=case when operation='publish' then 'published' when operation in ('unpublish','restore') then 'draft' else 'archived' end,deleted_at=case when operation='delete' then now() when operation='restore' then null else deleted_at end,published_at=case when operation='publish' then now() else published_at end,updated_by=auth.uid(),revision=revision+1 where id=product returning revision into result;
 insert into private.outbox_events(entity_id,event_type,revision) values(product,'catalog.'||operation,result);
 return result;
end $$;
create function public.product_lifecycle(product uuid,expected_revision bigint,operation text) returns bigint language sql security invoker set search_path='' as $$ select private.lifecycle(product,expected_revision,operation) $$;

-- Narrow function permissions; new PostgreSQL functions otherwise default to PUBLIC EXECUTE.
revoke execute on all functions in schema public from public,anon;
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function private.current_role(),private.require_role(text[]),private.create_draft(text,text,text),private.save_draft(jsonb),private.publish_errors(uuid),private.lifecycle(uuid,bigint,text) to authenticated;
grant execute on function public.create_product_draft(text,text,text),public.save_product_draft(jsonb),public.product_publish_errors(uuid),public.product_lifecycle(uuid,bigint,text) to authenticated;

-- Owner-evaluated view is intentional: anon has no underlying table grants.
-- The explicit projection and predicate are the only public access path.
create view public_catalog.products with (security_barrier=true) as select p.id,p.name,p.slug,p.product_code,p.short_description,p.description,p.product_type,p.country_of_origin,p.is_featured,p.is_new_arrival,p.seo_title,p.seo_description,p.published_at,p.updated_at,c.name as category_name,c.slug as category_slug,b.name as brand_name,(select m.delivery_url from public.product_media m where m.product_id=p.id and m.is_primary and m.upload_status='ready' limit 1) as image_url from public.products p join public.categories c on c.id=p.primary_category_id left join public.brands b on b.id=p.brand_id where p.status='published' and p.deleted_at is null and c.is_active;
revoke all on schema public_catalog from public;
grant usage on schema public_catalog to anon,authenticated;
grant select on public_catalog.products to anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('catalog-documents','catalog-documents',false,10485760,array['application/pdf']);
-- No browser storage writes or anonymous reads: verified server workflows are required.
commit;
