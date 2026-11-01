// Packaging only. No database connection, deployment or history repair.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const sha = (value) => createHash('sha256').update(value).digest('hex');
const files = fs
  .readdirSync('supabase/migrations')
  .filter((file) => /^\d{14}_.+\.sql$/.test(file))
  .sort();
const additions = files.filter((file) => file.startsWith('20261101'));
if (!additions.length) throw new Error('No refinement migrations found');
const manifest = {
  scope: 'ANN Traders 2026-11-01 additive production refinement',
  productionAuthorized: false,
  databaseConnections: 0,
  prerequisiteMigrations: files
    .filter((file) => !additions.includes(file))
    .map((file) => ({ file, sha256: sha(fs.readFileSync('supabase/migrations/' + file)) })),
  additiveMigrations: additions.map((file) => ({
    file,
    sha256: sha(fs.readFileSync('supabase/migrations/' + file)),
  })),
};
fs.mkdirSync('docs/production-refinement', { recursive: true });
fs.writeFileSync(
  'docs/production-refinement/migration-manifest.json',
  JSON.stringify(manifest, null, 2) + '\n',
);
fs.writeFileSync(
  'docs/production-refinement/upgrade-review.sql',
  '-- REVIEW ONLY. Match target, ledger, prerequisite hashes and backup before operator-approved application.\n' +
    '-- Prefer the original versioned files through Supabase CLI so migration history is recorded.\n' +
    additions
      .map(
        (file) =>
          `\n-- ${file} SHA256 ${sha(fs.readFileSync('supabase/migrations/' + file))}\n` +
          fs.readFileSync('supabase/migrations/' + file, 'utf8'),
      )
      .join('\n'),
);
console.log(
  JSON.stringify({
    prerequisites: manifest.prerequisiteMigrations.length,
    additions: additions.length,
    databaseConnections: 0,
  }),
);
