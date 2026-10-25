-- Object keys are canonical; URLs remain compatible delivery hints for existing consumers.
-- No product_media columns, rows, permissions or authentication behavior change.
begin;
create or replace view public_catalog.products with (security_barrier=true) as
select p.id,p.name,p.slug,p.product_code,p.short_description,p.description,p.product_type,p.country_of_origin,p.is_featured,p.is_new_arrival,p.seo_title,p.seo_description,p.published_at,p.updated_at,c.name as category_name,c.slug as category_slug,b.name as brand_name,
(select m.delivery_url from public.product_media m where m.product_id=p.id and m.is_primary and m.upload_status='ready' limit 1) as image_url,
coalesce((select jsonb_agg(jsonb_build_object('kind',e->>'kind','url',e->>'url','width',(e->>'width')::integer,'height',(e->>'height')::integer,'key',e->>'key')) from public.product_media m cross join lateral jsonb_array_elements(m.object_manifest) e where m.product_id=p.id and m.is_primary and m.upload_status='ready'),'[]'::jsonb) as image_variants,
(select e->>'key' from public.product_media m cross join lateral jsonb_array_elements(m.object_manifest) e where m.product_id=p.id and m.is_primary and m.upload_status='ready' and m.provider='r2' and e->>'kind'='detail' limit 1) as image_key
from public.products p join public.categories c on c.id=p.primary_category_id left join public.brands b on b.id=p.brand_id where p.status='published' and p.deleted_at is null and c.is_active;
-- A URL on a former/current delivery origin can reference the same canonical key.
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
 if not exists(select 1 from public.product_media other cross join lateral jsonb_array_elements(other.object_manifest) entry where other.id<>m.id and other.upload_status='ready' and entry->>'key'=e->>'key')
 and not exists(select 1 from public.categories where image_path=e->>'url' or split_part(split_part(image_path,'?',1),'#',1) like '%/'||(e->>'key'))
 and not exists(select 1 from public.brands where logo_path=e->>'url' or split_part(split_part(logo_path,'?',1),'#',1) like '%/'||(e->>'key')) then keys=keys||jsonb_build_array(e);end if;
 end loop;end if;
 return jsonb_build_object('staging_key',m.staging_key,'staging_bucket',m.staging_bucket,'public_bucket',m.public_bucket,'objects',keys,'origin',m.delivery_origin);
end$$;
commit;
