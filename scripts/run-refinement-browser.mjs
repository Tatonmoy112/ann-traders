// Repeatable production-browser rehearsal. All network targets are loopback and
// provider data is synthetic. Only child processes created here are stopped.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
const connection = process.env.TEST_DATABASE_URL;
if (!connection || !['127.0.0.1', 'localhost'].includes(new URL(connection).hostname))
  throw new Error('Use an isolated local TEST_DATABASE_URL');
const root = process.cwd();
const development = process.argv.includes('--dev');
const port = Number(process.env.ANN_REFINEMENT_CLIENT_PORT || 3001);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('Invalid local test port');
const origin = `http://localhost:${port}`;
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55440',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-public-key',
  NEXT_PUBLIC_SITE_URL: origin,
  CLIENT_SECURITY_BUILD: 'true',
  INTERNAL_CATALOG_REVALIDATE_SECRET: randomBytes(32).toString('hex'),
  NEXT_TELEMETRY_DISABLED: '1',
  CATALOG_PUBLIC_DOCUMENT_DOWNLOADS: 'false',
  R2_PUBLIC_BASE_URL: '',
  R2_ENVIRONMENT: 'development',
};
const next = path.join(root, 'apps/client/node_modules/next/dist/bin/next');
const start = (args, cwd = root) =>
  spawn(process.execPath, args, { cwd, env, stdio: 'inherit', windowsHide: true });
const completed = (child) =>
  new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Local test child failed (${code})`)),
    );
  });
async function ready(url, headers = {}) {
  for (let attempt = 0; attempt < 240; attempt++) {
    try {
      if ((await fetch(url, { headers, signal: AbortSignal.timeout(1000) })).ok) return;
    } catch {
      /* startup */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Local test server did not become ready');
}
async function stop(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    await new Promise((resolve) => killer.once('exit', resolve));
  } else {
    child.kill('SIGTERM');
    await new Promise((resolve) => {
      child.once('exit', resolve);
      setTimeout(resolve, 3000).unref();
    });
  }
}
let fixture, app;
try {
  if (!development)
    await completed(start([next, 'build', '--webpack'], path.join(root, 'apps/client')));
  fixture = start(['tests/fixtures/public-catalog-server.mjs']);
  await ready('http://127.0.0.1:55440/rest/v1/categories?select=id&limit=1', {
    apikey: 'test-public-key',
    'accept-profile': 'public_catalog',
  });
  app = start(
    [next, development ? 'dev' : 'start', '--hostname', '127.0.0.1', '--port', String(port)],
    path.join(root, 'apps/client'),
  );
  await ready(`http://127.0.0.1:${port}/products`);
  await fetch(`http://127.0.0.1:${port}/api/catalog/revalidate`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.INTERNAL_CATALOG_REVALIDATE_SECRET },
  });
  await completed(start(['scripts/verify-production-refinement-browser.mjs']));
} finally {
  await stop(app);
  await stop(fixture);
}
