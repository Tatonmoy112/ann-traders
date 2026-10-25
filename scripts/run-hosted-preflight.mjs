// Remote READ-ONLY checks only. No migration, history repair or deployment capability.
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import pg from 'pg';
import { resolve4, resolve6 } from 'node:dns/promises';
const env = parseEnv(fs.readFileSync('apps/admin/.env.local', 'utf8'));
const report = {
  checkedAt: new Date().toISOString(),
  remoteWrites: false,
  tlsVerification: true,
  status: 'BLOCKED',
};
let db, databaseHost;
function blocked(reason) {
  const error = new Error(reason);
  error.safeReason = reason;
  throw error;
}
try {
  let connection = env.STAGING_DATABASE_URL || env.DATABASE_URL || env['direct connection string'];
  if (!connection) blocked('Missing STAGING_DATABASE_URL');
  const password = env.SUPABASE_DB_PASSWORD || env.project_database_password || env['project pass'];
  if (password)
    connection = connection.replace(
      /\[(YOUR[-_]PASSWORD|your[-_]password)\]/g,
      encodeURIComponent(password),
    );
  const url = new URL(connection);
  databaseHost = url.hostname;
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    blocked('Expected PostgreSQL connection URL');
  if (!url.hostname.endsWith('.supabase.co') && !url.hostname.endsWith('.pooler.supabase.com'))
    blocked('Database hostname must be the configured hosted Supabase endpoint');
  const api = new URL(env.STAGING_SUPABASE_URL || env.url || env.NEXT_PUBLIC_SUPABASE_URL || '');
  const project = api.hostname.split('.')[0];
  if (!api.hostname.endsWith('.supabase.co') || !/^[a-z0-9]+$/.test(project))
    blocked('Hosted Supabase API project could not be identified');
  if (url.hostname.endsWith('.supabase.co') && url.hostname !== `db.${project}.supabase.co`)
    blocked('Database hostname does not match the configured hosted Supabase project');
  if (
    url.hostname.endsWith('.pooler.supabase.com') &&
    decodeURIComponent(url.username) !== `postgres.${project}`
  )
    blocked('Pooler username does not match the configured hosted Supabase project');
  if (
    !url.password ||
    /\[(YOUR[-_]PASSWORD|your[-_]password)\]/.test(decodeURIComponent(url.password))
  )
    blocked('Database password is missing or still a placeholder');
  if (url.searchParams.get('sslmode') === 'disable')
    blocked('TLS-disabled database URLs are not accepted');
  const ssl = { rejectUnauthorized: true };
  if (env.STAGING_DATABASE_CA_CERT) ssl.ca = fs.readFileSync(env.STAGING_DATABASE_CA_CERT, 'utf8');
  // Discrete connection fields prevent URL SSL options from overriding certificate validation.
  db = new pg.Client({
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1) || 'postgres'),
    ssl,
    connectionTimeoutMillis: 10000,
    options: '-c default_transaction_read_only=on -c statement_timeout=10000 -c lock_timeout=3000',
  });
  await db.connect();
  const mode = await db.query('show default_transaction_read_only');
  if (mode.rows[0].default_transaction_read_only !== 'on')
    blocked('Read-only session was not established');
  report.connectedReadOnly = true;
  await db.query(fs.readFileSync('ops/staging/generated/preflight.sql', 'utf8'));
  report.status = 'PASS';
} catch (error) {
  if (db) await db.query('rollback').catch(() => {});
  const code = String(error.code || error.cause?.code || '');
  report.code = /^[A-Z0-9_]+$/.test(code) ? code : null;
  report.reason =
    error.safeReason ||
    (code === 'ENOTFOUND'
      ? 'Hosted database hostname does not resolve'
      : code === '55000'
        ? 'Existing objects or migration state rejected the empty-baseline preflight'
        : code === '28P01'
          ? 'Database authentication failed'
          : /TLS|CERT|SSL/.test(code)
            ? 'TLS certificate validation failed'
            : 'Database connection or read-only preflight failed');
  if (code === 'ENOTFOUND' && databaseHost) {
    const checks = await Promise.allSettled([resolve4(databaseHost), resolve6(databaseHost)]);
    report.dns = Object.fromEntries(
      checks.map((result, index) => [
        index === 0 ? 'ipv4' : 'ipv6',
        result.status === 'fulfilled'
          ? { resolves: result.value.length > 0 }
          : {
              resolves: false,
              code: /^[A-Z0-9_]+$/.test(result.reason?.code) ? result.reason.code : null,
            },
      ]),
    );
  }
} finally {
  if (db) await db.end().catch(() => {});
  fs.writeFileSync(
    'docs/verification/hosted-preflight-results.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'PASS') process.exitCode = 1;
}
