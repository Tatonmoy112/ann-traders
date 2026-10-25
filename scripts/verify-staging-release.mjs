// Release rehearsal: loopback only; creates separate databases, never resets/drops data.
import fs from 'node:fs';
import pg from 'pg';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const local = JSON.parse(
  fs.readFileSync('.local-r2/supabase-status.json', 'utf8').replace(/^\uFEFF/, ''),
);
const target = new URL(local.DB_URL);
assert.ok(['localhost', '127.0.0.1'].includes(target.hostname));
assert.equal(target.port, '54322');
assert.equal(new URL(local.API_URL).port, '54321');
const manifest = JSON.parse(fs.readFileSync('ops/staging/generated/manifest.json', 'utf8'));
const bundle = fs.readFileSync('ops/staging/generated/baseline.sql', 'utf8');
assert.equal(createHash('sha256').update(bundle).digest('hex'), manifest.bundleSha256);
for (const migration of manifest.migrations)
  assert.equal(
    createHash('sha256')
      .update(fs.readFileSync('supabase/migrations/' + migration.file))
      .digest('hex'),
    migration.sha256,
  );
const existing = new pg.Client({ connectionString: local.DB_URL });
await existing.connect();
const report = {
  verifiedAt: new Date().toISOString(),
  remoteWrites: false,
  existingDatabaseChanges: false,
  checks: [],
  databases: [],
};
const record = (name) => {
  report.checks.push({ check: name, status: 'PASS' });
  console.log('PASS: ' + name);
};
async function rejectsWithoutCommit(db, sql, code) {
  try {
    await db.query(sql);
    throw new Error('Expected rejection');
  } catch (error) {
    await db.query('rollback');
    assert.equal(error.code, code);
  }
}
try {
  await existing.query(fs.readFileSync('ops/staging/generated/verify.sql', 'utf8'));
  record('Postflight passes against the actual local Supabase stack');
  const preflight = fs.readFileSync('ops/staging/generated/preflight.sql', 'utf8');
  const before = (await existing.query('select count(*)::int n from public.products')).rows[0].n;
  await rejectsWithoutCommit(existing, preflight, '55000');
  assert.equal(
    (await existing.query('select count(*)::int n from public.products')).rows[0].n,
    before,
  );
  record('Populated local application is rejected without data changes');
  const bootstrap = fs.readFileSync('scripts/local-postgres-bootstrap.sql', 'utf8');
  for (const scenario of ['rollback', 'collision']) {
    const name = 'ann_release_' + scenario + '_' + Date.now();
    assert.match(name, /^[a-z0-9_]+$/);
    await existing.query('create database ' + name);
    report.databases.push(name);
    const url = new URL(target);
    url.pathname = '/' + name;
    const db = new pg.Client({ connectionString: url.toString() });
    await db.connect();
    try {
      await db.query(bootstrap);
      // Exercise a real empty Supabase ledger shape without recording any fake versions.
      await db.query(
        'create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text)',
      );
      if (scenario === 'collision') {
        await db.query(
          'create table public.unrelated_customer_data(id integer primary key);insert into public.unrelated_customer_data values(1)',
        );
        await rejectsWithoutCommit(db, bundle, '55000');
        assert.equal(
          (await db.query('select count(*)::int n from public.unrelated_customer_data')).rows[0].n,
          1,
        );
        assert.equal(
          (await db.query("select to_regclass('public.products') relation")).rows[0].relation,
          null,
        );
        record('Unrelated public data blocks the baseline and remains untouched');
      } else {
        await db.query(preflight);
        await db.query('begin');
        await db.query('insert into supabase_migrations.schema_migrations(version) values($1)', [
          'fixture-only',
        ]);
        await rejectsWithoutCommit(
          db,
          fs.readFileSync('ops/staging/preflight-guard.sql', 'utf8'),
          '55000',
        );
        assert.equal(
          (await db.query('select count(*)::int n from supabase_migrations.schema_migrations'))
            .rows[0].n,
          0,
        );
        record('An existing migration ledger blocks a baseline and the fixture rolls back');
        const injected = bundle.replace(
          "notify pgrst, 'reload schema';",
          "select ann_release_expected_failure();\nnotify pgrst, 'reload schema';",
        );
        await rejectsWithoutCommit(db, injected, '42883');
        assert.equal(
          (await db.query("select count(*)::int n from pg_tables where schemaname='public'"))
            .rows[0].n,
          0,
        );
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from storage.buckets where id='catalog-documents'",
            )
          ).rows[0].n,
          0,
        );
        record('Late failure rolls back the entire schema and PDF bucket insert');
        await db.query(bundle);
        await db.query(fs.readFileSync('ops/staging/generated/verify.sql', 'utf8'));
        assert.equal(
          (await db.query("select count(*)::int n from pg_tables where schemaname='public'"))
            .rows[0].n,
          28,
        );
        record(
          'Atomic baseline installs all 28 tables, RLS, R2 grants, public keys and private PDFs',
        );
        await rejectsWithoutCommit(db, bundle, '55000');
        assert.equal(
          (await db.query("select count(*)::int n from pg_tables where schemaname='public'"))
            .rows[0].n,
          28,
        );
        record('Reapplying an installed baseline fails safely');
        assert.equal(manifest.recordsSupabaseMigrationHistory, false);
      }
    } finally {
      await db.end();
    }
  }
  record('Source and bundle SHA-256 checksums match');
} finally {
  await existing.end();
  fs.writeFileSync(
    'docs/verification/staging-release-results.json',
    JSON.stringify(report, null, 2) + '\n',
  );
}
