begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
-- PostgreSQL NUMERIC NaN compares greater than finite numbers and can pass > 0.
-- Preserve data: validation fails the entire migration if an existing value
-- needs operator review. Never coerce financial or technical values silently.
do $$
declare field record; constraint_name text;
begin
  for field in
    select c.table_name,c.column_name
    from information_schema.columns c
    join information_schema.tables t using(table_catalog,table_schema,table_name)
    where c.table_schema='public' and c.data_type='numeric' and t.table_type='BASE TABLE'
    order by c.table_name,c.ordinal_position
  loop
    constraint_name='finite_'||field.column_name;
    execute format('alter table public.%I add constraint %I check (%I not in (''NaN''::numeric,''Infinity''::numeric,''-Infinity''::numeric)) not valid',
      field.table_name,constraint_name,field.column_name);
    execute format('alter table public.%I validate constraint %I',field.table_name,constraint_name);
  end loop;
end $$;
commit;
