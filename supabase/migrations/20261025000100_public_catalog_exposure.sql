-- Expose public catalog views in schema public for PostgREST anonymous delivery
begin;

create or replace view public.catalog_products with (security_barrier=true) as
select * from public_catalog.products;

create or replace view public.catalog_variants with (security_barrier=true) as
select * from public_catalog.variants;

create or replace view public.catalog_documents with (security_barrier=true) as
select * from public_catalog.documents;

-- Grant read-only anonymous access to catalog views
grant select on public.catalog_products to anon, authenticated;
grant select on public.catalog_variants to anon, authenticated;
grant select on public.catalog_documents to anon, authenticated;

-- Grant read-only access to categories and brands for public navigation
grant select on public.categories to anon;
grant select on public.brands to anon;

-- Refresh PostgREST schema cache
notify pgrst, 'reload schema';

commit;

