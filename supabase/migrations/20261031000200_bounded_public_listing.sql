-- EXPLAIN showed card media/pricing being evaluated before the outer LIMIT.
-- Select narrow identities first and bound expensive projections to pageSize+1.
begin;
create view public_catalog.product_index with (security_barrier=true) as
select p.id,p.name,p.product_code,p.short_description,p.published_at,p.updated_at,
  p.is_featured,p.is_new_arrival,c.slug as category_slug,b.slug as brand_slug
from public.products p join public.categories c on c.id=p.primary_category_id and c.is_active
left join public.brands b on b.id=p.brand_id and b.is_active
where p.status='published' and p.deleted_at is null;
grant select on public_catalog.product_index to anon,authenticated;

create function public_catalog.list_product_cards(
  category_filter text default '',brand_filter text default '',search_query text default '',
  featured_only boolean default false,new_only boolean default false,
  page_number integer default 1,page_size integer default 12,
  sort_field text default 'updated_at',sort_ascending boolean default false
) returns setof public_catalog.product_cards
language plpgsql stable security invoker set search_path='' as $$
declare
  field text=case when sort_field in ('name','published_at','updated_at') then sort_field else 'updated_at' end;
  direction text=case when sort_ascending then 'asc' else 'desc' end;
  size integer=least(24,greatest(1,coalesce(page_size,12)));
  page integer=least(10000,greatest(1,coalesce(page_number,1)));
begin
  return query execute format($query$
    with selected as materialized (
      select i.id,row_number() over(order by %1$I %2$s,i.id) as position
      from public_catalog.product_index i
      where ($1='' or i.category_slug=$1) and ($2='' or i.brand_slug=$2)
        and ($3='' or i.name ilike '%%'||$3||'%%' or i.product_code ilike '%%'||$3||'%%'
          or i.short_description ilike '%%'||$3||'%%')
        and (not $4 or i.is_featured) and (not $5 or i.is_new_arrival)
      order by %1$I %2$s,i.id limit $6 offset $7
    )
    select card.* from selected s
    cross join lateral (
      select c.* from public_catalog.product_cards c where c.id=s.id offset 0
    ) card order by s.position
  $query$,field,direction)
  using left(coalesce(category_filter,''),180),left(coalesce(brand_filter,''),180),
    left(coalesce(search_query,''),80),coalesce(featured_only,false),coalesce(new_only,false),
    size+1,(page-1)*size;
end $$;
revoke all on function public_catalog.list_product_cards(text,text,text,boolean,boolean,integer,integer,text,boolean) from public;
grant execute on function public_catalog.list_product_cards(text,text,text,boolean,boolean,integer,integer,text,boolean) to anon,authenticated;
notify pgrst,'reload schema';
commit;
