-- Metadata only. Never read application rows or change hosted state.
begin read only;
set local statement_timeout = '10s';
select jsonb_build_object(
  'relations', (select coalesce(jsonb_agg(jsonb_build_object('schema', n.nspname, 'name', c.relname, 'kind', c.relkind, 'rls', c.relrowsecurity) order by n.nspname, c.relname), '[]'::jsonb)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private', 'public_catalog', 'supabase_migrations') and c.relkind in ('r','p','v','m','f','S')),
  'functions', (select coalesce(jsonb_agg(jsonb_build_object('schema', n.nspname, 'name', p.proname, 'arguments', pg_get_function_identity_arguments(p.oid)) order by n.nspname, p.proname), '[]'::jsonb)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'public_catalog')
      and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')),
  'columns', (select coalesce(jsonb_agg(jsonb_build_object('schema', table_schema, 'table', table_name, 'name', column_name, 'type', data_type) order by table_schema, table_name, ordinal_position), '[]'::jsonb)
    from information_schema.columns where table_schema in ('public', 'private', 'public_catalog', 'supabase_migrations')),
  'enums', (select coalesce(jsonb_agg(jsonb_build_object('schema', n.nspname, 'type', t.typname, 'label', e.enumlabel) order by n.nspname, t.typname, e.enumsortorder), '[]'::jsonb)
    from pg_type t join pg_namespace n on n.oid=t.typnamespace join pg_enum e on e.enumtypid=t.oid
    where n.nspname in ('public', 'private', 'public_catalog')),
  'policies', (select coalesce(jsonb_agg(jsonb_build_object('schema', schemaname, 'table', tablename, 'name', policyname) order by schemaname, tablename, policyname), '[]'::jsonb)
    from pg_policies where schemaname in ('public', 'private', 'public_catalog')),
  'platform_rls_helper', (select jsonb_build_object('definition', pg_get_functiondef(p.oid), 'owner', pg_get_userbyid(p.proowner), 'return_type', p.prorettype::regtype::text, 'security_definer', p.prosecdef, 'config', p.proconfig)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='rls_auto_enable' and p.pronargs=0),
  'event_triggers', (select coalesce(jsonb_agg(jsonb_build_object('name', e.evtname, 'event', e.evtevent, 'enabled', e.evtenabled, 'tags', e.evttags, 'function', e.evtfoid::regproc::text, 'owner', pg_get_userbyid(e.evtowner)) order by e.evtname), '[]'::jsonb)
    from pg_event_trigger e),
  'prerequisites', jsonb_build_object('auth_users', to_regclass('auth.users') is not null, 'storage_buckets', to_regclass('storage.buckets') is not null, 'auth_uid', to_regprocedure('auth.uid()') is not null, 'auth_jwt', to_regprocedure('auth.jwt()') is not null, 'extensions', exists(select 1 from pg_namespace where nspname='extensions'))
) as schema_inventory;
rollback;
