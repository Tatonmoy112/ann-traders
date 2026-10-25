begin;
-- SQL CHECK treats NULL as unknown/accepted, so required price fields are explicit.
alter table public.variant_prices add constraint required_price_amounts check(
 (price_type='on_request' and min_price is null and max_price is null) or
 (price_type='fixed' and min_price is not null and min_price>0 and max_price is null) or
 (price_type='range' and min_price is not null and max_price is not null and min_price>0 and max_price>=min_price)
);
alter table public.product_attribute_values add check(value_text is null or length(trim(value_text))>0);
alter table public.variant_attribute_values add check(value_text is null or length(trim(value_text))>0);
create unique index attribute_code_fold on public.attribute_definitions(lower(code));
create unique index industries_slug_fold on public.industries(lower(slug));
create unique index applications_slug_fold on public.applications(lower(slug));
create unique index fibers_code_fold on public.fibers(lower(code));
create unique index equipment_brand_model on public.equipment_models(brand_id,lower(model_name));
create unique index certifications_name_fold on public.certifications(lower(name));
create function private.quantity_unit_guard() returns trigger language plpgsql set search_path='' as $$
declare field text;unit_id uuid;
begin
 foreach field in array case tg_table_name when 'product_variants' then array['base_unit_id','minimum_order_unit_id','capacity_unit_id'] when 'variant_prices' then array['price_unit_id'] when 'price_tiers' then array['quantity_unit_id'] else array['pack_unit_id'] end loop
 unit_id=(to_jsonb(new)->>field)::uuid;
 if exists(select 1 from public.units where id=unit_id and (unit_family='areal_density' or not is_active)) then raise exception '% must use an active quantity unit, not GSM',field;end if;
 end loop;return new;
end $$;
do $$declare t text;begin foreach t in array array['product_variants','variant_prices','price_tiers','variant_packaging'] loop execute format('create trigger quantity_unit_guard before insert or update on public.%I for each row execute function private.quantity_unit_guard()',t);end loop;end$$;
create or replace function private.current_role() returns text language sql stable security definer set search_path='' as $$ select role from public.admin_profiles where id=auth.uid() and is_active and (role='editor' or auth.jwt()->>'aal'='aal2') $$;
-- Profile administration is server-mediated. Actor cannot change their own role/state.
create function public.manage_admin(actor uuid,target uuid,display_name text,new_role text,active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if actor=target or not exists(select 1 from public.admin_profiles where id=actor and is_active and role='super_admin') then raise exception 'Role change denied' using errcode='42501';end if;
 if new_role not in ('super_admin','admin','editor') or length(trim(display_name))<2 then raise exception 'Invalid administrator details';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 insert into public.admin_profiles(id,full_name,role,is_active) values(target,display_name,new_role,active) on conflict(id) do update set full_name=excluded.full_name,role=excluded.role,is_active=excluded.is_active;
end $$;
revoke execute on function public.manage_admin(uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.manage_admin(uuid,uuid,text,text,boolean) to service_role;
revoke execute on function private.quantity_unit_guard() from public,anon,authenticated;
commit;
