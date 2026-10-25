-- Preserve migration history and data; include pinned bucket names expected by the worker.
begin;
create or replace function public.r2_prepare_cleanup(media uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m public.product_media;keys jsonb='[]';e jsonb;
begin
 select * into m from public.product_media where id=media for update;
 if m.id is null or m.provider<>'r2' then raise exception 'R2 media not found';end if;
 if m.upload_expires_at+interval '10 minutes'>now() or m.verification_lease_until>now() then raise exception 'Upload capability or verification lease is still active';end if;
 if m.upload_status not in ('ready','retired') then update public.product_media set upload_status='failed',verification_token=null,verification_lease_until=null where id=media;end if;
 if m.upload_status<>'ready' then
 for e in select value from jsonb_array_elements(m.object_manifest) loop
 if not exists(select 1 from public.product_media other cross join lateral jsonb_array_elements(other.object_manifest) entry where other.id<>m.id and other.upload_status='ready' and entry->>'key'=e->>'key') and not exists(select 1 from public.categories where image_path=e->>'url') and not exists(select 1 from public.brands where logo_path=e->>'url') then keys=keys||jsonb_build_array(e);end if;
 end loop;end if;
 return jsonb_build_object('staging_key',m.staging_key,'staging_bucket',m.staging_bucket,'public_bucket',m.public_bucket,'objects',keys,'origin',m.delivery_origin);
end$$;
-- CREATE OR REPLACE preserves the existing service-role-only grants.
commit;
