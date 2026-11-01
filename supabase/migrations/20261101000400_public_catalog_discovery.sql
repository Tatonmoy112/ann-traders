-- Narrow anonymous discovery; raw tables and private upload paths stay private.
begin;

create function private.specification_matches(attribute uuid,choice uuid,txt text,num numeric,
  flag boolean,unit uuid,filter jsonb) returns boolean
language sql stable set search_path='' as $$
  select coalesce(exists(select 1 from public.attribute_definitions a
    left join public.units du on du.id=a.default_unit_id
    left join public.units u on u.id=unit
    where a.id=attribute and a.id=(filter->>'attribute')::uuid and a.is_active and a.is_filterable
      and (case a.data_type
        when 'select' then choice=(filter->>'option')::uuid
        when 'multi_select' then choice=(filter->>'option')::uuid
        when 'boolean' then flag=(filter->>'boolean')::boolean
        when 'text' then lower(txt)=lower(filter->>'text')
        when 'number' then
          (a.default_unit_id is null and unit is null or
            u.id=du.id or u.unit_family=du.unit_family and u.factor_to_base is not null and du.factor_to_base is not null)
          and (not filter ? 'min' or num*coalesce(u.factor_to_base/du.factor_to_base,1)>=(filter->>'min')::numeric)
          and (not filter ? 'max' or num*coalesce(u.factor_to_base/du.factor_to_base,1)<=(filter->>'max')::numeric)
        else false end)),false)
$$;

create function public_catalog.browse_product_cards(
  category_filter text default '',brand_filter text default '',search_query text default '',
  featured_only boolean default false,new_only boolean default false,
  page_number integer default 1,page_size integer default 12,
  sort_field text default 'updated_at',sort_ascending boolean default false,
  attribute_filters jsonb default '[]',after_cursor jsonb default null
) returns jsonb language plpgsql stable security definer set search_path=''
set statement_timeout='8s' as $$
declare field text; direction text; size integer; page integer; pattern text;
  f jsonb; result jsonb; cursor_value text; cursor_id uuid; cursor_rank integer;
begin
  field=case when sort_field in ('name','published_at','updated_at') then sort_field else 'updated_at' end;
  direction=case when coalesce(sort_ascending,false) then 'asc' else 'desc' end;
  size=least(24,greatest(1,coalesce(page_size,12)));
  page=least(10000,greatest(1,coalesce(page_number,1)));
  category_filter=left(coalesce(category_filter,''),180);
  brand_filter=left(coalesce(brand_filter,''),180);
  search_query=btrim(left(coalesce(search_query,''),80));
  pattern=replace(replace(replace(search_query,'\','\\'),'%','\%'),'_','\_');
  if jsonb_typeof(attribute_filters) is distinct from 'array' or jsonb_array_length(attribute_filters)>8 then
    raise exception 'Use at most eight technical filters' using errcode='22023';
  end if;
  for f in select value from jsonb_array_elements(attribute_filters) loop
    if jsonb_typeof(f) is distinct from 'object' or not f ? 'attribute' or (f->>'attribute')::uuid is null
      or not (f ? 'option' or f ? 'boolean' or f ? 'text' or f ? 'min' or f ? 'max')
      or (f ? 'option' and (f->>'option')::uuid is null)
      or (f ? 'boolean' and jsonb_typeof(f->'boolean') is distinct from 'boolean')
      or (f ? 'text' and (jsonb_typeof(f->'text') is distinct from 'string' or length(f->>'text') not between 1 and 100))
      or (f ? 'min' and (f->>'min' is null or f->>'min' !~ '^-?[0-9]{1,14}(\.[0-9]{1,4})?$'))
      or (f ? 'max' and (f->>'max' is null or f->>'max' !~ '^-?[0-9]{1,14}(\.[0-9]{1,4})?$'))
      or (f ? 'min' and f ? 'max' and (f->>'min')::numeric>(f->>'max')::numeric)
    then raise exception 'Invalid technical filter' using errcode='22023'; end if;
  end loop;
  if after_cursor is not null then
    if jsonb_typeof(after_cursor) is distinct from 'object' or after_cursor->>'sort' is distinct from field
      or after_cursor->>'direction' is distinct from direction or after_cursor->>'value' is null
      or after_cursor->>'id' is null or after_cursor->>'rank' is null then
      raise exception 'Invalid catalog cursor' using errcode='22023';
    end if;
    cursor_id=(after_cursor->>'id')::uuid;
    cursor_value=left(after_cursor->>'value',300);
    cursor_rank=(after_cursor->>'rank')::integer;
  end if;
  execute format($query$
    with recursive selected_categories as (
      select c.id,1 as depth from public.categories c where c.slug=$1 and c.is_active
      union all select c.id,sc.depth+1 from public.categories c join selected_categories sc on c.parent_id=sc.id
        where c.is_active and sc.depth<8
    ), search_matches as materialized (
      select id,min(rank) as rank from (
        select p.id,case when lower(p.product_code)=lower($3) then 0
          when p.product_code ilike $10||'%%' then 2 else 4 end as rank
        from public.products p where $3<>'' and (p.search_vector @@ websearch_to_tsquery('simple',$3)
          or p.name ilike '%%'||$10||'%%' or p.product_code ilike '%%'||$10||'%%'
          or p.short_description ilike '%%'||$10||'%%')
        union all
        select v.product_id,case when lower(v.sku)=lower($3) or lower(v.model_number)=lower($3)
            or lower(v.manufacturer_part_number)=lower($3) then 1
          when v.sku ilike $10||'%%' or v.model_number ilike $10||'%%' or v.manufacturer_part_number ilike $10||'%%' then 3 else 5 end
        from public.product_variants v where $3<>'' and v.is_active and
          (v.sku ilike '%%'||$10||'%%' or v.model_number ilike '%%'||$10||'%%' or v.manufacturer_part_number ilike '%%'||$10||'%%')
      ) matches group by id
    ), selected as materialized (
      select p.id,p.%1$I as sort_value,%7$s as rank
      from public.products p
      join public.categories c on c.id=p.primary_category_id and c.is_active
      left join public.brands b on b.id=p.brand_id and b.is_active
      left join search_matches sm on sm.id=p.id
      where p.status='published' and p.deleted_at is null
        and ($1='' or p.primary_category_id in (select id from selected_categories)
          or p.id in (select ec.product_id from public.product_extra_categories ec
            where ec.category_id in (select id from selected_categories)))
        and ($2='' or b.slug=$2) and ($3='' or sm.id is not null)
        and (not $4 or p.is_featured) and (not $5 or p.is_new_arrival)
        and (jsonb_array_length($8)=0 or exists(select 1 from public.product_variants v
          where v.product_id=p.id and v.is_active and not exists(
            select 1 from jsonb_array_elements($8) f where not (
              exists(select 1 from public.product_attribute_values av where av.product_id=p.id
                and private.specification_matches(av.attribute_id,av.option_id,av.value_text,av.value_number,av.value_boolean,av.unit_id,f))
              or exists(select 1 from public.variant_attribute_values av where av.variant_id=v.id
                and private.specification_matches(av.attribute_id,av.option_id,av.value_text,av.value_number,av.value_boolean,av.unit_id,f))
            ))))
        and ($9::uuid is null or %7$s>$12 or
          %7$s=$12 and (p.%1$I %3$s $11::%4$s or p.%1$I=$11::%4$s and p.id>$9))
      order by %7$s,p.%1$I %2$s,p.id limit $6 offset $7
    ), cards as materialized (
      select card.*,s.rank,s.sort_value from selected s cross join lateral (
        select c.* from public_catalog.product_cards c where c.id=s.id offset 0
      ) card order by s.rank,s.sort_value %2$s,s.id
    ) select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(card)-'rank'-'sort_value'
        order by card.rank,card.sort_value %2$s,card.id) from cards card),'[]'::jsonb),
      'next_cursor',(select jsonb_build_object('id',s.id,'value',s.sort_value,'rank',s.rank,'sort',%5$L,'direction',%6$L)
        from selected s order by s.rank,s.sort_value %2$s,s.id offset $6-2 limit 1))
  $query$,field,direction,case when direction='asc' then '>' else '<' end,
    case when field='name' then 'text' else 'timestamptz' end,field,direction,
    case when search_query='' then '0::integer' else 'coalesce(sm.rank,0)' end)
  into result using category_filter,brand_filter,search_query,coalesce(featured_only,false),coalesce(new_only,false),
    size+1,case when cursor_id is null then (page-1)*size else 0 end,attribute_filters,cursor_id,pattern,cursor_value,cursor_rank;
  return result;
end $$;

-- Preserve the existing nine-argument RPC and its pageSize+1 contract.
create or replace function public_catalog.list_product_cards(
  category_filter text default '',brand_filter text default '',search_query text default '',
  featured_only boolean default false,new_only boolean default false,
  page_number integer default 1,page_size integer default 12,
  sort_field text default 'updated_at',sort_ascending boolean default false
) returns setof public_catalog.product_cards
language sql stable security invoker set search_path='' as $$
  select * from jsonb_populate_recordset(null::public_catalog.product_cards,
    public_catalog.browse_product_cards(category_filter,brand_filter,search_query,featured_only,new_only,
      page_number,page_size,sort_field,sort_ascending)->'rows')
$$;

create function public_catalog.category_filters(category_filter text default '') returns jsonb
language sql stable security definer set search_path='' set statement_timeout='8s' as $$
  with rules as (
    select distinct r.attribute_id from public.categories c
    cross join lateral private.category_rules(c.id) r
    where c.is_active and (coalesce(category_filter,'')='' or c.slug=left(category_filter,180))
  ), attributes as (
    select a.id,a.code,a.name,a.data_type,u.symbol as unit,
      case when a.data_type in ('select','multi_select') then coalesce((select jsonb_agg(to_jsonb(o)) from (
        select o.id,o.label from public.attribute_options o where o.attribute_id=a.id and o.is_active
        order by o.sort_order,o.label,o.id limit 100) o),'[]'::jsonb) else '[]'::jsonb end as options
    from public.attribute_definitions a join rules r on r.attribute_id=a.id
    left join public.units u on u.id=a.default_unit_id
    where a.is_active and a.is_filterable order by a.sort_order,a.name,a.id limit 32
  ) select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) from attributes a
$$;

-- Product specs were absent from the existing detail projection. Append safe,
-- typed values, plus composition and equipment fit, without exposing raw rows.
create view public_catalog.product_specifications with (security_barrier=true) as
select av.product_id,a.code,a.name as label,av.value_text as text,av.value_number::text as number,
  av.value_boolean as boolean,o.label as option,u.symbol as unit,a.sort_order
from public.product_attribute_values av join public_catalog.visibility p on p.id=av.product_id
join public.attribute_definitions a on a.id=av.attribute_id and a.is_active
left join public.attribute_options o on o.id=av.option_id and o.is_active
left join public.units u on u.id=av.unit_id
where av.option_id is null or o.id is not null;

create or replace view public_catalog.product_details with (security_barrier=true) as
select p.slug,to_jsonb(p)||jsonb_build_object('key_features',(select key_features from public.products where id=p.id),'specifications',coalesce((select jsonb_agg(
  to_jsonb(s)-'product_id'-'sort_order' order by s.sort_order,s.code)
  from public_catalog.product_specifications s where s.product_id=p.id),'[]'::jsonb)) as product,
  coalesce((select jsonb_agg(to_jsonb(v)||jsonb_build_object('packaging',
    coalesce((select jsonb_agg(jsonb_build_object('type',pkg.packaging_type,'quantity',pkg.pack_quantity::text,
      'unit',u.symbol,'description',pkg.package_description) order by pkg.is_default desc,pkg.id)
      from public.variant_packaging pkg join public.units u on u.id=pkg.pack_unit_id where pkg.variant_id=v.id),'[]'::jsonb),
    'composition',coalesce((select jsonb_agg(jsonb_build_object('fiber',f.name,'percentage',fc.percentage::text) order by f.name)
      from public.variant_fiber_composition fc join public.fibers f on f.id=fc.fiber_id and f.is_active where fc.variant_id=v.id),'[]'::jsonb),
    'equipment',coalesce((select jsonb_agg(jsonb_build_object('brand',b.name,'model',e.model_name,'notes',ec.compatibility_notes) order by b.name,e.model_name)
      from public.variant_equipment_compatibility ec join public.equipment_models e on e.id=ec.equipment_model_id
      join public.brands b on b.id=e.brand_id and b.is_active where ec.variant_id=v.id),'[]'::jsonb)) order by v.is_default desc,v.sku,v.id)
    from (select * from public_catalog.variants where product_id=p.id order by is_default desc,sku,id limit 100) v),'[]'::jsonb) as variants,
  coalesce((select jsonb_agg(to_jsonb(d) order by d.title,d.id) from (
    select * from public_catalog.documents where product_id=p.id order by title,id limit 100) d),'[]'::jsonb) as documents,
  coalesce((select jsonb_agg(jsonb_build_object('kind','detail','url',coalesce(image.detail->>'url',image.delivery_url),
    'key',coalesce(image.detail->>'key',''),'width',coalesce((image.detail->>'width')::integer,800),
    'height',coalesce((image.detail->>'height')::integer,800)) order by image.is_primary desc,image.sort_order,image.id)
    from (select m.id,m.is_primary,m.sort_order,m.delivery_url,
      (select e from jsonb_array_elements(m.object_manifest) e where e->>'kind'='detail' limit 1) as detail
      from public.product_media m where m.product_id=p.id and m.upload_status='ready' and m.retired_at is null
        and m.media_type='image' and (m.variant_id is null or exists(select 1 from public.product_variants v where v.id=m.variant_id and v.is_active))
      order by m.is_primary desc,m.sort_order,m.id limit 100) image
    where coalesce(image.detail->>'url',image.delivery_url) is not null),'[]'::jsonb) as gallery
from public_catalog.products p;

revoke execute on function private.specification_matches(uuid,uuid,text,numeric,boolean,uuid,jsonb) from public,anon,authenticated;
revoke execute on function public_catalog.browse_product_cards(text,text,text,boolean,boolean,integer,integer,text,boolean,jsonb,jsonb),
  public_catalog.category_filters(text) from public;
grant execute on function public_catalog.browse_product_cards(text,text,text,boolean,boolean,integer,integer,text,boolean,jsonb,jsonb),
  public_catalog.category_filters(text) to anon,authenticated;
grant select on public_catalog.product_specifications to anon,authenticated;
revoke insert,update,delete,truncate,references,trigger on public_catalog.product_specifications from anon,authenticated;
notify pgrst,'reload schema';
commit;
