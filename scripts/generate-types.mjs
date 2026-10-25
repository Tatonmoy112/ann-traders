import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const r = spawnSync('pnpm', ['exec', 'supabase', 'gen', 'types', 'typescript', '--local'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
if (r.status !== 0) {
  console.error(r.stderr);
  process.exit(r.status ?? 1);
}
writeFileSync('packages/database/src/database.types.ts', r.stdout);
