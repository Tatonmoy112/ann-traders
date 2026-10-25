-- Additive upgrade: preserve all existing media, audit history and the 28 core entities.
begin;
alter table public.product_media
 add column staging_key text unique,
 add column staging_bucket text,
 add column public_bucket text,
 add column delivery_origin text,
 add column upload_expires_at timestamptz,
 add column verification_token uuid,
 add column verification_lease_until timestamptz,
 add column object_manifest jsonb not null default '[]',
 add column sha256 text,
 add column verified_at timestamptz,
 add column retired_at timestamptz,
 add column replaces_media_id uuid references public.product_media(id) on delete restrict;
do $$declare c record;begin
 for c in select conname from pg_constraint where conrelid='public.product_media'::regclass and contype='c' and conkey && array(select attnum from pg_attribute where attrelid='public.product_media'::regclass and attname in ('provider','delivery_url','upload_status')) loop
 execute format('alter table public.product_media drop constraint %I',c.conname);
 end loop;
end$$;
alter table public.product_media
 add constraint media_provider_check check(provider in ('cloudflare_images','r2')),
 add constraint media_state_check check(upload_status in ('pending','verifying','ready','failed','retired')),
 add constraint media_ready_check check(upload_status<>'ready' or (provider_asset_id is not null and delivery_url is not null and retired_at is null)),
 add constraint media_primary_check check(not is_primary or (upload_status='ready' and retired_at is null)),
 add constraint media_url_check check(delivery_url is null or (provider='cloudflare_images' and delivery_url ~ '^https://imagedelivery.net/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+$') or (provider='r2' and delivery_origin is not null and delivery_url like delivery_origin||'/catalog/%/detail.webp')),
 add constraint media_manifest_check check(jsonb_typeof(object_manifest)='array' and jsonb_array_length(object_manifest)<=3),
 add constraint media_hash_check check(sha256 is null or sha256 ~ '^[a-f0-9]{64}$');

create function public.r2_create_upload(actor uuid,product uuid,expected_revision bigint,media uuid,mime text,size_bytes bigint,origin text,staging_bucket_name text,public_bucket_name text,replacement uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare expires timestamptz=now()+interval '5 minutes';
begin
 perform private.integration_actor(actor,product,expected_revision);
 perform pg_advisory_xact_lock(hashtextextended('image-quota:'||actor::text,0));
 if mime not in ('image/jpeg','image/png','image/webp') or size_bytes<1 or size_bytes>10485760 then raise exception 'Invalid image declaration';end if;
 if origin !~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?$' and origin !~ '^http://(127\.0\.0\.1|localhost):[0-9]+$' then raise exception 'Invalid delivery origin';end if;
 if (select count(*) from public.product_media where uploaded_by=actor and created_at>now()-interval '1 hour')>=50 then raise exception 'Hourly upload quota reached';end if;
 if staging_bucket_name !~ '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$' or public_bucket_name !~ '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$' or staging_bucket_name=public_bucket_name then raise exception 'Invalid R2 buckets';end if;
 if replacement is not null and not exists(select 1 from public.product_media where id=replacement and product_id=product and upload_status='ready' and retired_at is null) then raise exception 'Replacement image not found';end if;
 insert into public.product_media(id,product_id,media_type,provider,provider_asset_id,staging_key,delivery_origin,uploaded_by,content_type,bytes,upload_expires_at,replaces_media_id,staging_bucket,public_bucket)
 values(media,product,'image','r2','catalog/'||product||'/'||media,'staging/'||product||'/'||media,origin,actor,mime,size_bytes,expires,replacement,staging_bucket_name,public_bucket_name);
 -- Every issued capability has a durable cleanup task, even if the browser disappears.
 insert into private.outbox_events(entity_id,event_type,revision,payload,available_at) values(media,'r2.cleanup',0,jsonb_build_object('media_id',media),expires+interval '10 minutes');
 return jsonb_build_object('media',media,'expires_at',expires);
end$$;

create function public.r2_claim_upload(actor uuid,product uuid,expected_revision bigint,media uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.product_media;token uuid=gen_random_uuid();
begin
 perform private.integration_actor(actor,product,expected_revision);
 select * into m from public.product_media where id=media and product_id=product and uploaded_by=actor and provider='r2' for update;
 if m.id is null then raise exception 'Upload ownership mismatch' using errcode='42501';end if;
 if m.upload_status='ready' then return jsonb_build_object('ready',true);end if;
 if m.retired_at is not null or m.upload_status='failed' or m.upload_expires_at<=now() then raise exception 'Upload session expired or failed; start a new upload';end if;
 if m.verification_lease_until>now() then raise exception 'This upload is already being verified' using errcode='40001';end if;
 -- A previous planned promotion must be reconciled before another attempt.
 if jsonb_array_length(m.object_manifest)>0 then raise exception 'Promotion recovery is pending; start a new upload';end if;
 update public.product_media set upload_status='verifying',verification_token=token,verification_lease_until=now()+interval '5 minutes' where id=media;
 return jsonb_build_object('token',token,'staging_key',m.staging_key,'bytes',m.bytes,'mime',m.content_type,'origin',m.delivery_origin,'staging_bucket',m.staging_bucket,'public_bucket',m.public_bucket);
end$$;

create function public.r2_plan_promotion(actor uuid,media uuid,token uuid,manifest jsonb,digest text,image_width integer,image_height integer) returns void language plpgsql security definer set search_path='' as $$
declare m public.product_media;e jsonb; kinds text[]='{}';
begin
 select * into m from public.product_media where id=media for update;
 if m.uploaded_by is distinct from actor or m.upload_status<>'verifying' or m.verification_token is distinct from token or m.verification_lease_until<=now() then raise exception 'Verification lease lost' using errcode='40001';end if;
 if not exists(select 1 from public.admin_profiles where id=actor and is_active) then raise exception 'Inactive actor' using errcode='42501';end if;
 if jsonb_typeof(manifest)<>'array' or jsonb_array_length(manifest)<>3 or digest !~ '^[a-f0-9]{64}$' or image_width not between 100 and 12000 or image_height not between 100 and 12000 then raise exception 'Invalid verified manifest';end if;
 for e in select value from jsonb_array_elements(manifest) loop
 if e->>'kind' not in ('thumbnail','card','detail') or e->>'key' is distinct from m.provider_asset_id||'/'||token||'/'||(e->>'kind')||'.webp' or e->>'url' is distinct from m.delivery_origin||'/'||(e->>'key') or (e->>'bytes')::bigint not between 1 and 20971520 or (e->>'width')::integer not between 1 and 2000 or (e->>'height')::integer not between 1 and 2000 or e->>'sha256' !~ '^[a-f0-9]{64}$' then raise exception 'Invalid public object manifest';end if;
 kinds=array_append(kinds,e->>'kind');
 end loop;
 if not kinds @> array['thumbnail','card','detail'] then raise exception 'Missing responsive image size';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 update public.product_media set object_manifest=manifest,sha256=digest,width=image_width,height=image_height where id=media;
end$$;

create function public.r2_finish_upload(actor uuid,product uuid,expected_revision bigint,media uuid,token uuid) returns bigint language plpgsql security definer set search_path='' as $$
declare m public.product_media;old_media public.product_media;result bigint;
begin
 -- Idempotent success does not mutate again or consume another revision.
 select * into m from public.product_media where id=media and product_id=product and uploaded_by=actor and provider='r2';
 if m.id is null then raise exception 'Upload ownership mismatch' using errcode='42501';end if;
 if m.upload_status='ready' then if not exists(select 1 from public.admin_profiles where id=actor and is_active) then raise exception 'Inactive actor' using errcode='42501';end if;select revision into result from public.products where id=product;return result;end if;
 perform private.integration_actor(actor,product,expected_revision);
 select * into m from public.product_media where id=media for update;
 if m.upload_status<>'verifying' or m.verification_token is distinct from token or m.verification_lease_until<=now() or jsonb_array_length(m.object_manifest)<>3 then raise exception 'Verification lease lost' using errcode='40001';end if;
 if m.replaces_media_id is not null then
 select * into old_media from public.product_media where id=m.replaces_media_id and product_id=product and upload_status='ready' and retired_at is null for update;
 if old_media.id is null then raise exception 'Replacement target changed' using errcode='40001';end if;
 update public.product_media set is_primary=false,upload_status='retired',retired_at=now() where id=old_media.id;
 insert into private.outbox_events(entity_id,event_type,revision,payload,available_at) values(old_media.id,'image.retired',expected_revision,jsonb_build_object('media_id',old_media.id,'provider',old_media.provider,'asset_id',old_media.provider_asset_id),greatest(now(),coalesce(old_media.upload_expires_at+interval '10 minutes',now())));
 end if;
 update public.product_media set upload_status='ready',verified_at=now(),delivery_url=(select e->>'url' from jsonb_array_elements(m.object_manifest) e where e->>'kind'='detail'),external_url=(select e->>'url' from jsonb_array_elements(m.object_manifest) e where e->>'kind'='detail'),is_primary=case when old_media.id is not null then old_media.is_primary else not exists(select 1 from public.product_media where product_id=product and is_primary and upload_status='ready') end,sort_order=coalesce(old_media.sort_order,m.sort_order),variant_id=coalesce(old_media.variant_id,m.variant_id),alt_text=coalesce(old_media.alt_text,m.alt_text),verification_lease_until=null where id=media;
 update public.products set revision=revision+1,updated_by=actor where id=product returning revision into result;
 return result;
end$$;

create function public.r2_fail_upload(actor uuid,media uuid,token uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from public.admin_profiles where id=actor and is_active) then raise exception 'Inactive actor' using errcode='42501';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 update public.product_media set upload_status='failed',verification_lease_until=null where id=media and uploaded_by=actor and verification_token=token and upload_status='verifying';
end$$;

create or replace function private.media_action(product uuid,expected_revision bigint,media uuid,operation text,alt text) returns bigint language plpgsql security definer set search_path='' as $$
declare m public.product_media;result bigint;
begin
 perform private.require_role(array['super_admin','admin','editor']);perform private.integration_actor(auth.uid(),product,expected_revision);
 select * into m from public.product_media where id=media and product_id=product and retired_at is null for update;if m.id is null then raise exception 'Image not found';end if;
 if operation='primary' and m.upload_status='ready' then update public.product_media set is_primary=false where product_id=product;update public.product_media set is_primary=true where id=media;
 elsif operation='alt' then update public.product_media set alt_text=left(alt,255) where id=media;
 elsif operation='detach' then update public.product_media set upload_status='retired',retired_at=now(),is_primary=false,verification_token=null,verification_lease_until=null where id=media;
 elsif operation='order' and alt ~ '^[0-9]{1,6}$' then update public.product_media set sort_order=alt::integer where id=media;
 else raise exception 'Invalid media action';end if;
 update public.products set revision=revision+1,updated_by=auth.uid() where id=product returning revision into result;
 if operation='detach' then insert into private.outbox_events(entity_id,event_type,revision,payload,available_at) values(media,'image.retired',result,jsonb_build_object('media_id',media,'provider',m.provider,'asset_id',m.provider_asset_id),greatest(now(),coalesce(m.upload_expires_at+interval '10 minutes',now())));end if;
 return result;
end$$;

create function public.r2_prepare_cleanup(media uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
 return jsonb_build_object('staging_key',m.staging_key,'objects',keys,'origin',m.delivery_origin);
end$$;
-- Existing legacy jobs remain provider-aware. Historical/retired rows are not live references.
create or replace function public.image_asset_referenced(asset text) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.product_media where provider_asset_id=asset and retired_at is null and upload_status in ('ready','pending','verifying')) or exists(select 1 from public.categories where image_path like '%'||asset||'%') or exists(select 1 from public.brands where logo_path like '%'||asset||'%') $$;

-- Close old upload capabilities without deleting old ready media or old PDF functions.
revoke execute on function public.stage_image(uuid,uuid,bigint,text,text,bigint),public.attach_verified_image(uuid,uuid,bigint,uuid,text) from service_role;
revoke execute on function public.r2_create_upload(uuid,uuid,bigint,uuid,text,bigint,text,text,text,uuid),public.r2_claim_upload(uuid,uuid,bigint,uuid),public.r2_plan_promotion(uuid,uuid,uuid,jsonb,text,integer,integer),public.r2_finish_upload(uuid,uuid,bigint,uuid,uuid),public.r2_fail_upload(uuid,uuid,uuid),public.r2_prepare_cleanup(uuid) from public,anon,authenticated;
grant execute on function public.r2_create_upload(uuid,uuid,bigint,uuid,text,bigint,text,text,text,uuid),public.r2_claim_upload(uuid,uuid,bigint,uuid),public.r2_plan_promotion(uuid,uuid,uuid,jsonb,text,integer,integer),public.r2_finish_upload(uuid,uuid,bigint,uuid,uuid),public.r2_fail_upload(uuid,uuid,uuid),public.r2_prepare_cleanup(uuid) to service_role;
-- Append a safe responsive projection without changing any existing public fields.
create or replace view public_catalog.products with (security_barrier=true) as
select p.id,p.name,p.slug,p.product_code,p.short_description,p.description,p.product_type,p.country_of_origin,p.is_featured,p.is_new_arrival,p.seo_title,p.seo_description,p.published_at,p.updated_at,c.name as category_name,c.slug as category_slug,b.name as brand_name,
(select m.delivery_url from public.product_media m where m.product_id=p.id and m.is_primary and m.upload_status='ready' limit 1) as image_url,
coalesce((select jsonb_agg(jsonb_build_object('kind',e->>'kind','url',e->>'url','width',(e->>'width')::integer,'height',(e->>'height')::integer)) from public.product_media m cross join lateral jsonb_array_elements(m.object_manifest) e where m.product_id=p.id and m.is_primary and m.upload_status='ready'),'[]'::jsonb) as image_variants
from public.products p join public.categories c on c.id=p.primary_category_id left join public.brands b on b.id=p.brand_id where p.status='published' and p.deleted_at is null and c.is_active;
commit;
