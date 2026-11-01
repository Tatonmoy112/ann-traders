-- EXPLAIN at 50,000 products showed a redundant visibility join scanning the
-- entire published catalog for one unique slug. Keep the exact public predicate
-- inline so the existing products_slug_key can serve a single-product detail.
begin;
create or replace view public_catalog.products with (security_barrier=true) as
select p.id,p.name,p.slug,p.product_code,p.short_description,p.description,
  p.product_type,p.country_of_origin,p.is_featured,p.is_new_arrival,
  p.seo_title,p.seo_description,p.published_at,p.updated_at,
  c.name as category_name,c.slug as category_slug,b.name as brand_name,
  media.delivery_url as image_url,coalesce(media.images,'[]'::jsonb) as image_variants,
  media.image_key
from public.products p
join public.categories c on c.id=p.primary_category_id and c.is_active
left join public.brands b on b.id=p.brand_id and b.is_active
left join lateral (
  select m.delivery_url,
    (select jsonb_agg(jsonb_build_object('kind',e->>'kind','url',e->>'url',
      'width',(e->>'width')::integer,'height',(e->>'height')::integer,'key',e->>'key'))
      from jsonb_array_elements(m.object_manifest) e
      where e->>'kind' in ('thumbnail','card','detail')) as images,
    (select e->>'key' from jsonb_array_elements(m.object_manifest) e
      where e->>'kind'='detail' limit 1) as image_key
  from public.product_media m where m.product_id=p.id and m.upload_status='ready'
    and m.retired_at is null and m.media_type='image'
    and (m.variant_id is null or exists(select 1 from public.product_variants v
      where v.id=m.variant_id and v.is_active))
  order by m.is_primary desc,m.sort_order,m.id limit 1
) media on true
where p.status='published' and p.deleted_at is null;
notify pgrst,'reload schema';
commit;
