-- Evidence: docs/production-refinement/performance-index-comparison.json.
-- 5,000 products, same fixture/transaction: technical filter P95 159.19 ->
-- 6.56 ms; actual inner plan 102.099 -> 2.351 ms and uses this index shape.
-- Existing status/updated_at and FK/GIN indexes are retained.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
create index products_published_name_id on public.products(name,id)
  where status='published' and deleted_at is null;
commit;
