// Local scheduler only. Hosted worker invocation/scheduling is operator controlled.
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { readR2Config } from '../packages/storage/src/index.ts';
const env = parseEnv(fs.readFileSync('apps/admin/.env.local', 'utf8'));
const config = readR2Config(env);
const api = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
if (
  config.environment !== 'development' ||
  !['localhost', '127.0.0.1'].includes(api.hostname) ||
  api.port !== '54321' ||
  !env.CATALOG_WORKER_SECRET
)
  throw new Error('This command requires the local development Supabase stack and worker secret');
const watch = process.argv.includes('--watch');
let stopped = false;
process.on('SIGINT', () => {
  stopped = true;
});
process.on('SIGTERM', () => {
  stopped = true;
});
do {
  try {
    const response = await fetch(api.origin + '/functions/v1/catalog-worker', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.CATALOG_WORKER_SECRET },
      signal: AbortSignal.timeout(90000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('Local worker request failed');
    const result = await response.json();
    console.log(
      JSON.stringify({
        event: 'local_media_worker',
        completed: result.completed,
        failed: result.failed,
      }),
    );
    if (result.failed && !watch) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ event: 'local_media_worker_unavailable', error: error.name }));
    if (!watch) process.exitCode = 1;
  }
  if (watch && !stopped) await new Promise((resolve) => setTimeout(resolve, 15000));
} while (watch && !stopped);
