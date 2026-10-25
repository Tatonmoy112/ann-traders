-- Read-only assertions. Baseline migrations change grants/RLS across public tables,
-- so this release requires an empty, dedicated application namespace.
do $ann_preflight$
declare applied bigint;
begin
 if to_regclass('auth.users') is null or to_regclass('storage.buckets') is null
    or to_regprocedure('auth.uid()') is null or to_regprocedure('auth.jwt()') is null
    or not exists(select 1 from pg_namespace where nspname='extensions') then
   raise exception 'Supabase platform prerequisites are missing' using errcode='55000';
 end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname in ('public','private','public_catalog') and c.relkind in ('r','p','v','m','f','S'))
    or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
              where n.nspname in ('public','private','public_catalog')
              and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e'))
    or exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
              where n.nspname in ('public','private','public_catalog') and t.typtype in ('e','d')) then
   raise exception 'Baseline blocked: existing application or unrelated public objects need an incremental migration review' using errcode='55000';
 end if;
 if exists(select 1 from storage.buckets where id='catalog-documents') then
   raise exception 'Baseline blocked: catalog-documents already exists; review its configuration and migration history' using errcode='55000';
 end if;
 if to_regclass('supabase_migrations.schema_migrations') is not null then
   if exists(select 1 from pg_attribute where attrelid='supabase_migrations.schema_migrations'::regclass and attname='version' and not attisdropped) then
     execute 'select count(*) from supabase_migrations.schema_migrations' into applied;
     if applied > 0 then
       raise exception 'Baseline blocked: migration history exists; deploy only reviewed missing migrations' using errcode='55000';
     end if;
   else
     raise exception 'Unexpected migration ledger shape' using errcode='55000';
   end if;
 end if;
end $ann_preflight$;
