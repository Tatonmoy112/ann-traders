// Hosted inspection is GET-only / PostgreSQL read-only. Never print connection strings or keys.
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import pg from 'pg';
const env = parseEnv(fs.readFileSync('apps/admin/.env.local', 'utf8'));
const report = { date: new Date().toISOString(), remoteWrites: false, checks: [] };
if (process.argv.includes('--ledger-absent-confirmed')) {
  report.hostedLedgerEvidence = {
    source: 'User-provided hosted SQL Editor result',
    code: '42P01',
    relation: 'supabase_migrations.schema_migrations',
    exists: false,
  };
}
const migrations = fs
  .readdirSync('supabase/migrations')
  .filter((n) => n.endsWith('.sql'))
  .sort();
report.repositoryMigrations = migrations;
if (report.hostedLedgerEvidence) report.requiredMigrationChain = migrations;
const url = env.url || env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.service_role_key || env.SUPABASE_SERVICE_ROLE_KEY;
const required = [
  ...new Set(
    migrations.flatMap((name) =>
      [
        ...fs
          .readFileSync('supabase/migrations/' + name, 'utf8')
          .matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)/gi),
      ].map((m) => m[1]),
    ),
  ),
];
try {
  const origin = new URL(url);
  if (origin.protocol !== 'https:' || !origin.hostname.endsWith('.supabase.co'))
    throw new Error('Expected hosted project');
  const response = await fetch(origin.origin + '/rest/v1/', {
    headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/openapi+json' },
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error('Hosted schema unavailable');
  const schema = await response.json();
  report.missingExposedRpcs = required.filter((name) => !schema.paths?.['/rpc/' + name]);
  report.missingExposedTables = [
    'admin_profiles',
    'products',
    'product_media',
    'product_documents',
  ].filter((name) => !schema.paths?.['/' + name]);
} catch (error) {
  report.checks.push({ check: 'hosted-rest-schema', status: 'unavailable', error: error.name });
}
let db;
try {
  let connection = env['direct connection string'];
  if (!connection) throw new Error('Missing direct connection');
  if (env['project pass'])
    connection = connection.replace(
      /\[(YOUR[-_]PASSWORD|your[-_]password)\]/g,
      encodeURIComponent(env['project pass']),
    );
  const parsed = new URL(connection);
  if (
    !parsed.hostname.endsWith('.supabase.co') &&
    !parsed.hostname.endsWith('.pooler.supabase.com')
  )
    throw new Error('Unexpected database host');
  db = new pg.Client({
    connectionString: connection,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: true },
    options: '-c default_transaction_read_only=on -c statement_timeout=10000',
  });
  await db.connect();
  await db.query('begin read only');
  const history = await db.query(
    'select version from supabase_migrations.schema_migrations order by version',
  );
  report.appliedMigrationVersions = history.rows.map((r) => r.version);
  const applied = new Set(report.appliedMigrationVersions);
  report.confirmedMissingMigrations = migrations.filter((name) => !applied.has(name.split('_')[0]));
  await db.query('rollback');
} catch (error) {
  report.checks.push({
    check: 'hosted-migration-history',
    status: 'unavailable',
    error: error.name,
    code: /^[A-Z0-9_]+$/.test(error.code) ? error.code : null,
  });
  report.migrationHistoryVerified = false;
} finally {
  if (db) await db.end().catch(() => {});
}
fs.writeFileSync(
  'docs/verification/r2-hosted-schema-audit.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report, null, 2));
