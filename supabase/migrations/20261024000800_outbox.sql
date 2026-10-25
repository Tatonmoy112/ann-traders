begin;
-- Durable bounded outbox consumer. PGMQ/Cron installation is environment specific;
-- this ledger works without extensions and is the authoritative recovery record.
alter table private.outbox_events add column lease_until timestamptz,add column last_error text,add column dead_lettered_at timestamptz;
create index outbox_available on private.outbox_events(available_at,created_at) where completed_at is null and dead_lettered_at is null;
create function public.claim_catalog_jobs(batch_size integer default 10) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if batch_size<1 or batch_size>25 then raise exception 'Invalid batch size';end if;
 with picked as (select id from private.outbox_events where completed_at is null and dead_lettered_at is null and available_at<=now() and (lease_until is null or lease_until<now()) order by created_at for update skip locked limit batch_size),claimed as (update private.outbox_events e set lease_until=now()+interval '120 seconds',attempts=attempts+1 from picked where e.id=picked.id returning e.*) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]') into result from claimed;
 return result;
end $$;
create function public.complete_catalog_job(job uuid,attempt integer,success boolean,error_text text default '') returns void language plpgsql security definer set search_path='' as $$
begin
 update private.outbox_events set completed_at=case when success then now() else null end,lease_until=null,last_error=case when success then null else left(error_text,500) end,available_at=now()+make_interval(secs=>least(3600,power(2,least(attempts,10))::integer*5)),dead_lettered_at=case when not success and attempts>=8 then now() else null end where id=job and attempts=attempt and completed_at is null;
end $$;
create function public.image_asset_referenced(asset text) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.product_media where provider_asset_id=asset) or exists(select 1 from public.categories where image_path like '%'||asset||'%') or exists(select 1 from public.brands where logo_path like '%'||asset||'%') $$;
revoke execute on function public.claim_catalog_jobs(integer),public.complete_catalog_job(uuid,integer,boolean,text),public.image_asset_referenced(text) from public,anon,authenticated;
grant execute on function public.claim_catalog_jobs(integer),public.complete_catalog_job(uuid,integer,boolean,text),public.image_asset_referenced(text) to service_role;
revoke all on private.outbox_events from public,anon,authenticated;
commit;
