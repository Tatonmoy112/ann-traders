begin;
alter table public.products add check(length(trim(name))>=2),add check(product_code=trim(product_code) and length(product_code)>=2),add check(country_of_origin is null or country_of_origin ~ '^[A-Z]{2}$');
alter table public.product_variants add check(sku=trim(sku) and length(sku)>0),add check(length(trim(variant_name))>0);
alter table public.categories add check(length(trim(name))>0),add check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
alter table public.brands add check(length(trim(name))>0),add check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),add check(country_code is null or country_code ~ '^[A-Z]{2}$');
alter table public.industries add check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
alter table public.applications add check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
create or replace function private.category_tree_guard() returns trigger language plpgsql set search_path='' as $$
declare depth integer; subtree_depth integer; cyclic boolean;
begin
 perform pg_advisory_xact_lock(7241862);
 with recursive ancestors as (
 select c.id,c.parent_id,1 as n,array[c.id] as visited from public.categories c where c.id=new.parent_id
 union all select c.id,c.parent_id,a.n+1,a.visited||c.id from public.categories c join ancestors a on c.id=a.parent_id where a.n<9 and not c.id=any(a.visited)
 ) select coalesce(max(n),0),coalesce(bool_or(id=new.id),false) into depth,cyclic from ancestors;
 with recursive children as (
 select new.id as id,1 as n,array[new.id] as visited
 union all select c.id,ch.n+1,ch.visited||c.id from public.categories c join children ch on c.parent_id=ch.id where ch.n<9 and not c.id=any(ch.visited)
 ) select max(n) into subtree_depth from children;
 if cyclic or depth+subtree_depth>8 then raise exception 'Category would create a cycle or exceed depth 8'; end if;return new;
end $$;
create function private.tier_unit_guard() returns trigger language plpgsql set search_path='' as $$
declare p public.variant_prices;
begin
 select * into p from public.variant_prices where id=new.variant_price_id;
 if p.price_type='on_request' then raise exception 'On-request prices cannot define numeric tiers';end if;
 if new.quantity_unit_id is distinct from p.price_unit_id then raise exception 'Tier quantity units must match the price unit; convert explicitly before entry';end if;
 return new;
end $$;
create trigger tier_unit_guard before insert or update on public.price_tiers for each row execute function private.tier_unit_guard();
revoke execute on function private.tier_unit_guard() from public,anon,authenticated;
commit;
