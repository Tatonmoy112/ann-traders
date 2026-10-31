-- Review/apply incrementally; never reset a hosted project. Views intentionally
-- run as their migration owner: anon has no grants on normalized catalog tables.
begin;

revoke all on public.categories, public.brands, public.inquiries from anon;
-- The former FOR ALL policy applied to PUBLIC, overriding narrower admin rules.
drop policy if exists inquiries_service_all on public.inquiries;
create policy inquiries_service_all on public.inquiries for all to service_role
  using (true) with check (true);
revoke insert, delete on public.inquiries from authenticated;

create view public_catalog.visibility with (security_barrier=true) as
select p.id, p.slug, p.revision
from public.products p join public.categories c on c.id=p.primary_category_id
where p.status='published' and p.deleted_at is null and c.is_active;

create view public_catalog.categories with (security_barrier=true) as
select c.id,c.name,c.slug,c.description,c.parent_id,
  case when c.image_path ~ '^https://' then c.image_path end as image_path,c.sort_order
from public.categories c where c.is_active;
create view public_catalog.brands with (security_barrier=true) as
select b.id,b.name,b.slug,b.country_code,
  case when b.logo_path ~ '^https://' then b.logo_path end as logo_path
from public.brands b where b.is_active;

-- Only current public prices; no future/expired values or disabled variants.
create view public_catalog.effective_prices with (security_barrier=true) as
select pr.id,pr.variant_id,v.product_id,pr.currency_code,pr.price_type,
  pr.min_price,pr.max_price,pr.price_unit_id,u.symbol as unit,pr.trade_term,
  pr.valid_from,pr.valid_until
from public.variant_prices pr
join public.product_variants v on v.id=pr.variant_id and v.is_active
join public_catalog.visibility p on p.id=v.product_id
join public.units u on u.id=pr.price_unit_id
where pr.is_active and pr.valid_from<=now()
  and (pr.valid_until is null or pr.valid_until>now());

-- Correct the existing projection without changing its column contract/owner.
create or replace view public_catalog.products with (security_barrier=true) as
select p.id,p.name,p.slug,p.product_code,p.short_description,p.description,
  p.product_type,p.country_of_origin,p.is_featured,p.is_new_arrival,
  p.seo_title,p.seo_description,p.published_at,p.updated_at,
  c.name as category_name,c.slug as category_slug,b.name as brand_name,
  media.delivery_url as image_url,coalesce(media.images,'[]'::jsonb) as image_variants,
  media.image_key
from public.products p
join public_catalog.visibility visible on visible.id=p.id
join public.categories c on c.id=p.primary_category_id
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
) media on true;

create view public_catalog.product_cards with (security_barrier=true) as
select p.id,p.slug,p.name,p.product_code,left(p.short_description,240) as short_description,
  p.product_type,p.country_of_origin,p.is_featured,p.is_new_arrival,
  c.name as category_name,c.slug as category_slug,b.name as brand_name,b.slug as brand_slug,
  coalesce(image.card->>'url',image.delivery_url) as image_url,
  coalesce(image.card->>'key',null) as image_key,
  p.published_at,p.updated_at,
  case when pricing.comparable and pricing.priced_variants =
    (select count(*) from public.product_variants v where v.product_id=p.id and v.is_active)
  then jsonb_build_object('type',case when pricing.low=pricing.high then 'fixed' else 'range' end,
    'min',pricing.low::text,'max',pricing.high::text,'currency',pricing.currency,
    'unit',pricing.unit,'trade_term',pricing.trade_term,'valid_until',pricing.expires)
  else jsonb_build_object('type','on_request') end as display_price
from public.products p
join public_catalog.visibility visible on visible.id=p.id
join public.categories c on c.id=p.primary_category_id
left join public.brands b on b.id=p.brand_id and b.is_active
left join lateral (
  select m.delivery_url,(select e from jsonb_array_elements(m.object_manifest) e
    where e->>'kind'='card' limit 1) as card
  from public.product_media m where m.product_id=p.id and m.upload_status='ready'
    and m.retired_at is null and m.media_type='image'
    and (m.variant_id is null or exists(select 1 from public.product_variants v
      where v.id=m.variant_id and v.is_active))
  order by m.is_primary desc,m.sort_order,m.id limit 1
) image on true
left join lateral (
  select count(distinct pr.variant_id) as priced_variants,
    count(distinct (pr.currency_code,pr.price_unit_id,pr.trade_term))=1
      and bool_and(pr.price_type in ('fixed','range') and pr.min_price is not null
        and (pr.price_type='fixed' or pr.max_price is not null)) as comparable,
    min(pr.min_price) as low,max(coalesce(pr.max_price,pr.min_price)) as high,
    min(pr.currency_code) as currency,min(pr.unit) as unit,
    min(pr.trade_term) as trade_term,min(pr.valid_until) as expires
  from public_catalog.effective_prices pr where pr.product_id=p.id
) pricing on true;

create or replace view public_catalog.documents with (security_barrier=true) as
select d.id,d.product_id,d.variant_id,d.title,d.document_type,
  d.file_extension,d.bytes,p.name as product_name,p.product_code,p.slug as product_slug,
  d.created_at
from public.product_documents d join public_catalog.visibility visible on visible.id=d.product_id
join public.products p on p.id=d.product_id
where d.is_public and (d.variant_id is null or exists(
  select 1 from public.product_variants v where v.id=d.variant_id and v.is_active));

-- One product-scoped read; bounds follow aggregate editor limits. No private
-- document storage paths, upload manifests, supplier/customer data or actors.
create view public_catalog.product_details with (security_barrier=true) as
select p.slug,to_jsonb(p) as product,
  coalesce((select jsonb_agg(to_jsonb(v) || jsonb_build_object('packaging',
    coalesce((select jsonb_agg(jsonb_build_object('type',pkg.packaging_type,
      'quantity',pkg.pack_quantity::text,'unit',u.symbol,'description',pkg.package_description))
      from public.variant_packaging pkg join public.units u on u.id=pkg.pack_unit_id
      where pkg.variant_id=v.id),'[]'::jsonb))) from public_catalog.variants v
    where v.product_id=p.id),'[]'::jsonb) as variants,
  coalesce((select jsonb_agg(to_jsonb(d)) from public_catalog.documents d
    where d.product_id=p.id),'[]'::jsonb) as documents,
  coalesce((select jsonb_agg(jsonb_build_object('kind','detail',
    'url',coalesce(image.detail->>'url',image.delivery_url),
    'key',coalesce(image.detail->>'key',''),
    'width',coalesce((image.detail->>'width')::integer,800),
    'height',coalesce((image.detail->>'height')::integer,800)) order by image.is_primary desc,image.sort_order,image.id)
    from (select m.id,m.is_primary,m.sort_order,m.delivery_url,
      (select e from jsonb_array_elements(m.object_manifest) e where e->>'kind'='detail' limit 1) as detail
      from public.product_media m where m.product_id=p.id and m.upload_status='ready'
        and m.retired_at is null and m.media_type='image'
        and (m.variant_id is null or exists(select 1 from public.product_variants v
          where v.id=m.variant_id and v.is_active))
      order by m.is_primary desc,m.sort_order,m.id limit 100) image
    where coalesce(image.detail->>'url',image.delivery_url) is not null),'[]'::jsonb) as gallery
from public_catalog.products p;

grant select on public_catalog.visibility,public_catalog.categories,public_catalog.brands,
  public_catalog.effective_prices,public_catalog.product_cards,public_catalog.product_details,
  public_catalog.documents to anon,authenticated;
-- Defense against default table grants in hosted projects.
revoke insert,update,delete,truncate,references,trigger on all tables in schema public_catalog from anon,authenticated;
notify pgrst,'reload schema';
commit;
