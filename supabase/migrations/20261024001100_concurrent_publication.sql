begin;
create or replace function public.manage_admin(actor uuid,target uuid,display_name text,new_role text,active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 -- Serialize role changes so two super admins cannot disable each other concurrently.
 perform pg_advisory_xact_lock(3172456);
 if actor=target or not exists(select 1 from public.admin_profiles where id=actor and is_active and role='super_admin') then raise exception 'Role change denied' using errcode='42501';end if;
 if new_role not in ('super_admin','admin','editor') or length(trim(display_name))<2 then raise exception 'Invalid administrator details';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 insert into public.admin_profiles(id,full_name,role,is_active) values(target,display_name,new_role,active) on conflict(id) do update set full_name=excluded.full_name,role=excluded.role,is_active=excluded.is_active;
end $$;
create function private.lock_category_rules() returns trigger language plpgsql set search_path='' as $$begin
 perform 1 from public.categories where id=new.category_id for update;return new;
end$$;
-- Trigger names sort before the rule guard: take the category lock before checking publication.
create trigger category_00_lock before insert or update on public.category_attributes for each row execute function private.lock_category_rules();
create function private.recheck_publication() returns trigger language plpgsql security definer set search_path='' as $$
declare errors jsonb;
begin
 if new.status='published' and (old.status<>'published' or new.primary_category_id is distinct from old.primary_category_id) then
 perform 1 from public.categories where id=new.primary_category_id for share;
 errors=private.publish_errors(new.id);
 if jsonb_array_length(errors)>0 then raise exception '%',errors::text using errcode='23514';end if;
 end if;return new;
end$$;
create trigger product_publication_guard before update on public.products for each row execute function private.recheck_publication();
revoke execute on function private.lock_category_rules(),private.recheck_publication() from public,anon,authenticated;
commit;
