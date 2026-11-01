import pg from 'pg';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const connection = process.env.TEST_DATABASE_URL;
if (!connection || !['127.0.0.1', 'localhost'].includes(new URL(connection).hostname))
  throw new Error('Use the isolated local database');
const db = new pg.Client({ connectionString: connection });
await db.connect();
const report = {
  executedAt: new Date().toISOString(),
  scope:
    'Applied local PostgreSQL; Auth/Storage are test substitutes. This is not a hosted inventory.',
  objects: {},
};
const queries = {
  version: 'select version()',
  extensions: 'select extname,extversion from pg_extension order by extname',
  relations:
    "select n.nspname,c.relname,c.relkind,c.relrowsecurity,c.reloptions,pg_get_userbyid(c.relowner) as owner from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','public_catalog','private') and c.relkind in ('r','v') order by 1,2",
  columns:
    "select table_schema,table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema in ('public','public_catalog','private') order by 1,2,ordinal_position",
  constraints:
    "select n.nspname,c.relname,con.conname,con.contype,con.convalidated,pg_get_constraintdef(con.oid) as definition from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') order by 1,2,3",
  indexes:
    "select * from pg_indexes where schemaname in ('public','private') order by schemaname,tablename,indexname",
  policies:
    "select * from pg_policies where schemaname in ('public','private') order by schemaname,tablename,policyname",
  grants:
    "select table_schema,table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema in ('public','public_catalog','private') and grantee in ('anon','authenticated','service_role','PUBLIC') order by 1,2,3,4",
  functions:
    "select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,p.prosecdef,p.proconfig,p.proacl::text,pg_get_userbyid(p.proowner) as owner,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','public_catalog','private') and p.prokind='f' order by 1,2",
  views:
    "select * from pg_views where schemaname in ('public_catalog','public') order by schemaname,viewname",
  indexUsage:
    "select schemaname,relname,indexrelname,idx_scan,idx_tup_read,idx_tup_fetch from pg_stat_user_indexes where schemaname in ('public','private') order by 1,2,3",
  ledger: "select to_regclass('supabase_migrations.schema_migrations')::text as migration_ledger",
};
try {
  await db.query('begin read only');
  for (const [name, sql] of Object.entries(queries))
    report.objects[name] = (await db.query(sql)).rows;
  report.repositoryMigrations = fs
    .readdirSync('supabase/migrations')
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => ({
      name,
      sha256: createHash('sha256')
        .update(fs.readFileSync('supabase/migrations/' + name))
        .digest('hex'),
    }));
  fs.writeFileSync(
    'docs/production-refinement/schema-inventory.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      relations: report.objects.relations.length,
      migrations: report.repositoryMigrations.length,
      remoteConnections: 0,
    }),
  );
} finally {
  await db.query('rollback');
  await db.end();
}
