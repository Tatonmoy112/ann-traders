// Local-only configuration. Never prints keys or modifies a hosted project.
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { randomBytes } from 'node:crypto';
import { readR2Config } from '../packages/storage/src/index.ts';
const file = 'apps/admin/.env.local';
let source = fs.readFileSync(file, 'utf8');
const env = parseEnv(source);
const currentHost = new URL(env.R2_PUBLIC_BASE_URL).hostname;
const changes = {
  APP_ORIGIN: 'http://localhost:3000',
  R2_ENVIRONMENT: 'development',
  R2_CDN_PURGE_MODE: 'disabled',
  R2_STAGING_BUCKET: env.R2_STAGING_BUCKET || env.R2_UPLOAD_BUCKET,
  R2_PUBLIC_BASE_URL: /^pub-[a-z0-9]+\.r2\.dev$/.test(currentHost)
    ? env.R2_PUBLIC_BASE_URL
    : env['ann-traders-product-images_Public Development URL'],
  CATALOG_WORKER_SECRET: env.CATALOG_WORKER_SECRET || randomBytes(32).toString('hex'),
};
if (!new URL(changes.R2_PUBLIC_BASE_URL).hostname.endsWith('.r2.dev'))
  throw new Error('Set the real public-bucket r2.dev URL first');
readR2Config({ ...env, ...changes });
if (process.argv.includes('--supabase')) {
  const local = JSON.parse(
    fs.readFileSync('.local-r2/supabase-status.json', 'utf8').replace(/^\uFEFF/, ''),
  );
  if (new URL(local.API_URL).hostname !== '127.0.0.1' || !local.API_URL.endsWith(':54321'))
    throw new Error('Expected local Supabase');
  Object.assign(changes, {
    NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY || local.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
  });
  if (!changes.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !changes.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error('Missing generated local Supabase keys');
}
fs.mkdirSync('.local-r2', { recursive: true });
if (!fs.existsSync('.local-r2/.env.before-r2-development'))
  fs.writeFileSync('.local-r2/.env.before-r2-development', source);
for (const [name, value] of Object.entries(changes)) {
  const line = name + '=' + JSON.stringify(value);
  const pattern = new RegExp('^[ \\t]*(?:export[ \\t]+)?' + name + '[ \\t]*=.*$', 'gm');
  source = pattern.test(source)
    ? source.replace(pattern, () => line)
    : source.replace(/\s*$/, '') + '\n' + line + '\n';
}
const configured = parseEnv(source);
readR2Config(configured);
fs.writeFileSync(file, source);
const workerNames = [
  'APP_ORIGIN',
  'R2_ENVIRONMENT',
  'R2_CDN_PURGE_MODE',
  'R2_ACCOUNT_ID',
  'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_STAGING_BUCKET',
  'R2_PUBLIC_BUCKET',
  'R2_PUBLIC_BASE_URL',
  'R2_PREVIOUS_PUBLIC_BASE_URLS',
  'CATALOG_WORKER_SECRET',
];
fs.writeFileSync(
  'supabase/functions/.env.worker.local',
  workerNames
    .filter((name) => configured[name])
    .map((name) => name + '=' + JSON.stringify(configured[name]))
    .join('\n') + '\n',
);
console.log(
  JSON.stringify({
    localConfigurationUpdated: true,
    changedNames: Object.keys(changes),
    hostedConfigurationChanged: false,
    workerEnvFileWritten: true,
  }),
);
