// Deterministic local packaging only. Never connects to a database or deploys.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const sha = (value) => createHash('sha256').update(value).digest('hex');
const output = 'ops/staging/generated';
fs.mkdirSync(output, { recursive: true });
const files = fs
  .readdirSync('supabase/migrations')
  .filter((n) => /^\d{14}_.+\.sql$/.test(n))
  .sort();
if (files.length !== 14)
  throw new Error('Review the release scope before packaging a different migration count');
const manifest = {
  scope: 'ANN Traders staging baseline 001–014',
  generatedBy: 'scripts/prepare-staging-release.mjs',
  migrations: [],
  recordsSupabaseMigrationHistory: false,
};
let sql =
  "-- REVIEWED STAGING BASELINE ONLY. Explicit remote approval required.\n-- Preferred deployment: original Supabase CLI migrations, which record history.\n-- SQL Editor fallback: verify and repair CLI history afterward as documented.\nbegin;\nset local lock_timeout='5s';\nset local statement_timeout='120s';\nselect pg_advisory_xact_lock(hashtextextended('ann-traders-staging-baseline',0));\n";
const preflight = fs.readFileSync('ops/staging/preflight-guard.sql', 'utf8');
const postflight = fs.readFileSync('ops/staging/postflight-guard.sql', 'utf8');
sql += preflight + '\n';
for (const name of files) {
  const bytes = fs.readFileSync('supabase/migrations/' + name);
  let body = bytes.toString('utf8');
  if (
    [...body.matchAll(/^begin;\s*$/gim)].length !== 1 ||
    [...body.matchAll(/^commit;\s*$/gim)].length !== 1 ||
    /\b(create\s+index\s+concurrently|vacuum|alter\s+system|create\s+database)\b/i.test(body)
  )
    throw new Error('Migration needs manual transaction review: ' + name);
  body = body
    .replace(/^begin;\s*$/im, '')
    .replace(/^commit;\s*$/im, '')
    .replace(/^set search_path=public,extensions;$/im, 'set local search_path=public,extensions;');
  manifest.migrations.push({
    file: name,
    version: name.split('_')[0],
    sha256: sha(bytes),
    bytes: bytes.length,
  });
  sql += `\n-- SOURCE ${name} SHA256 ${sha(bytes)}\n${body}\n`;
}
sql += '\n' + postflight + "\nnotify pgrst, 'reload schema';\ncommit;\n";
manifest.bundleSha256 = sha(sql);
manifest.preflightSha256 = sha(preflight);
manifest.postflightSha256 = sha(postflight);
fs.writeFileSync(output + '/baseline.sql', sql);
fs.writeFileSync(output + '/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(output + '/preflight.sql', 'begin read only;\n' + preflight + '\nrollback;\n');
fs.writeFileSync(output + '/verify.sql', 'begin read only;\n' + postflight + '\nrollback;\n');
console.log(
  JSON.stringify({
    package: output,
    migrations: files.length,
    bundleSha256: manifest.bundleSha256,
    databaseConnections: 0,
  }),
);
