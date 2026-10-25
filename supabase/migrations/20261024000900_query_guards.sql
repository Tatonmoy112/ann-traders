begin;
-- Evaluate the current profile once per SQL statement rather than once per row.
do $$declare t text;begin
 for t in select tablename from pg_tables where schemaname='public' and tablename not in ('admin_profiles','audit_logs') loop
 execute format('drop policy active_admin_read on public.%I',t);
 execute format('create policy active_admin_read on public.%I for select to authenticated using((select private.current_role()) is not null)',t);
 end loop;
end $$;
drop policy audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select to authenticated using((select private.current_role()) in ('super_admin','admin'));
create or replace function private.attribute_guard() returns trigger language plpgsql set search_path='' as $$
declare dtype text; duplicate boolean; owner_id uuid;
begin
 select data_type into dtype from public.attribute_definitions where id=new.attribute_id for share;
 if (dtype='text' and new.value_text is null) or (dtype='number' and new.value_number is null) or (dtype='boolean' and new.value_boolean is null) or (dtype in ('select','multi_select') and new.option_id is null) then raise exception 'Attribute % requires % value',new.attribute_id,dtype; end if;
 owner_id=coalesce(to_jsonb(new)->>'product_id',to_jsonb(new)->>'variant_id')::uuid;
 -- Tuple locks serialize cardinality without one advisory-lock entry per SKU.
 if tg_table_name='product_attribute_values' then perform 1 from public.products where id=owner_id for update;
 else perform 1 from public.product_variants where id=owner_id for update;end if;
 execute format('select exists(select 1 from public.%I where %I=$1 and attribute_id=$2 and id<>$3 and ($4<>''multi_select'' or option_id=$5))',tg_table_name,case when tg_table_name='product_attribute_values' then 'product_id' else 'variant_id' end) into duplicate using owner_id,new.attribute_id,new.id,dtype,new.option_id;
 if duplicate then raise exception 'Duplicate value for attribute %',new.attribute_id; end if;return new;
end $$;
-- Changing category composition rules must also preserve published invariants.
create function private.category_composition_guard() returns trigger language plpgsql set search_path='' as $$begin
 if new.requires_composition is distinct from old.requires_composition and exists(select 1 from public.products where primary_category_id=new.id and status='published' and deleted_at is null) then raise exception 'Unpublish affected products before changing composition rules';end if;return new;end$$;
create trigger category_composition_guard before update on public.categories for each row execute function private.category_composition_guard();
revoke execute on function private.category_composition_guard() from public,anon,authenticated;
commit;
