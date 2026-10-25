import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { readR2Config } from '../packages/storage/src/index.ts';

const file = 'apps/admin/.env.local';
if (!fs.existsSync(file)) {
  console.log(JSON.stringify({ missingFile: file }));
  process.exit(1);
}
const env = parseEnv(fs.readFileSync(file, 'utf8'));
const expected = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_STAGING_BUCKET',
  'R2_PUBLIC_BUCKET',
  'R2_PUBLIC_BASE_URL',
  'R2_ENVIRONMENT',
  'R2_CDN_PURGE_MODE',
  'APP_ORIGIN',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CLOUDFLARE_ZONE_ID',
  'CLOUDFLARE_CACHE_PURGE_TOKEN',
  'CATALOG_WORKER_SECRET',
];
const report = {
  configuredNames: Object.keys(env).sort(),
  variables: Object.fromEntries(
    expected.map((name) => [
      name,
      env[name]?.trim()
        ? 'set'
        : env.R2_ENVIRONMENT === 'development' &&
            env.R2_CDN_PURGE_MODE === 'disabled' &&
            ['CLOUDFLARE_ZONE_ID', 'CLOUDFLARE_CACHE_PURGE_TOKEN'].includes(name)
          ? 'not required (development purge disabled)'
          : 'missing/empty',
    ]),
  ),
  bucketMatches: {
    staging: env.R2_STAGING_BUCKET === 'ann-traders-uploads-private',
    public: env.R2_PUBLIC_BUCKET === 'ann-traders-product-images',
  },
};
for (const [label, name] of [
  ['adminOrigin', 'APP_ORIGIN'],
  ['supabase', 'NEXT_PUBLIC_SUPABASE_URL'],
]) {
  try {
    const url = new URL(env[name]);
    report[label] = { valid: true, local: ['localhost', '127.0.0.1'].includes(url.hostname) };
  } catch {
    report[label] = { valid: false };
  }
}
try {
  readR2Config({ ...env, NODE_ENV: 'production' });
  report.adapterConfiguration = 'valid';
} catch (error) {
  const message = String(error.message);
  report.adapterConfiguration =
    /^(Missing |Invalid R2 account|R2 endpoint must|R2 public development|R2 development requires|CDN purge may|Invalid R2_ENVIRONMENT|Invalid R2_CDN_PURGE_MODE|Storage URLs must|Public delivery requires|Use a custom|Invalid R2_(STAGING|PUBLIC)_BUCKET|Private staging)/.test(
      message,
    )
      ? message
      : 'invalid storage URL/configuration (value redacted)';
}
console.log(JSON.stringify(report, null, 2));
