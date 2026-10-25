// Explicit live integration: LOCAL Supabase + local admin + real R2 diagnostic objects only.
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { createRequire } from 'node:module';
import { randomUUID, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import { R2Store, readR2Config } from '../packages/storage/src/index.ts';
const env = parseEnv(fs.readFileSync('apps/admin/.env.local', 'utf8'));
const local = JSON.parse(
  fs.readFileSync('.local-r2/supabase-status.json', 'utf8').replace(/^\uFEFF/, ''),
);
const origin = env.APP_ORIGIN;
assert.equal(origin, 'http://localhost:3000');
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname, '127.0.0.1');
assert.equal(new URL(local.DB_URL).hostname, '127.0.0.1');
const config = readR2Config(env);
assert.equal(config.environment, 'development');
assert.equal(config.purgeMode, 'disabled');
assert.ok(config.publicOrigin.endsWith('.r2.dev'));
const store = new R2Store(config);
const appRequire = createRequire(new URL('../apps/admin/package.json', import.meta.url));
const { createClient } = appRequire('@supabase/supabase-js');
const sharp = appRequire('sharp');
const { chromium, expect } = createRequire(import.meta.url)('@playwright/test');
const { HeadObjectCommand } = createRequire(
  new URL('../packages/storage/package.json', import.meta.url),
)('@aws-sdk/client-s3');
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const db = new pg.Client({ connectionString: local.DB_URL });
await db.connect();
const report = {
  date: new Date().toISOString(),
  localSupabase: true,
  hostedWrites: false,
  checks: [],
};
const runId = randomUUID();
const productIds = [],
  sessions = [];
const record = (check, status, detail = {}) => {
  const row = { check, status, ...detail };
  report.checks.push(row);
  console.log(JSON.stringify(row));
  fs.writeFileSync(
    'docs/verification/r2-local-integration.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  fs.writeFileSync(
    'docs/verification/r2-local-integration-' + runId + '.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  fs.writeFileSync(
    '.local-r2/local-r2-cleanup-' + runId + '.json',
    JSON.stringify(
      {
        productIds,
        sessions: sessions.map((s) => ({
          media: s.media,
          product: s.product,
          expires_at: s.expires_at,
        })),
      },
      null,
      2,
    ),
  );
};
let browser, page;
try {
  const email = 'r2-verification-' + randomUUID() + '@example.test',
    password = randomBytes(24).toString('base64url');
  const publicClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  const signup = await publicClient.auth.signUp({
    email: 'signup-probe-' + randomUUID() + '@example.test',
    password,
  });
  assert.equal(signup.error?.code, 'signup_disabled');
  record('public-self-signup-remains-disabled', 'PASS');
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ok(!created.error && created.data.user);
  await db.query(
    "insert into public.admin_profiles(id,full_name,role,is_active) values($1,'Local R2 Verification','editor',true)",
    [created.data.user.id],
  );
  fs.writeFileSync(
    '.local-r2/local-r2-user.json',
    JSON.stringify({ email, password, localOnly: true }, null, 2),
  );
  const chromiumPath =
    'C:/Users/taton/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
  browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_PATH ||
      (fs.existsSync(chromiumPath) ? chromiumPath : undefined),
  });
  page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await page.goto(origin + '/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 60000 });
  record('real-local-supabase-authentication', 'PASS');
  const response = await page.request.post(origin + '/api/admin/products', {
    headers: { Origin: origin },
    data: {
      name: 'R2 local verified product',
      product_code: 'R2-' + randomUUID(),
      slug: 'r2-local-' + randomUUID(),
    },
  });
  assert.equal(response.status(), 201);
  const product = (await response.json()).id;
  productIds.push(product);
  const image = await sharp({
    create: { width: 1200, height: 900, channels: 3, background: '#386b93' },
  })
    .png()
    .toBuffer();
  await page.goto(origin + '/products/' + product);
  await page.getByRole('button', { name: 'Images & documents', exact: true }).click();
  const stageResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/admin/images/create-upload') && r.request().method() === 'POST',
  );
  const completeResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/admin/images/complete-upload') && r.request().method() === 'POST',
    { timeout: 120000 },
  );
  await page
    .getByLabel('Upload product image', { exact: true })
    .setInputFiles({ name: 'r2-local.png', mimeType: 'image/png', buffer: image });
  const stage = await stageResponse;
  assert.equal(stage.status(), 200);
  const upload = await stage.json();
  sessions.push({ ...upload, product });
  record('authenticated-upload-session', 'PASS');
  const complete = await completeResponse;
  assert.equal(complete.status(), 200);
  record('browser-put-server-verification-and-attachment', 'PASS');
  const assets = await (
    await page.request.get(origin + `/api/admin/products/${product}/assets`)
  ).json();
  const ready = assets.images.find((m) => m.id === upload.media);
  assert.equal(ready.upload_status, 'ready');
  assert.equal(ready.is_primary, true);
  assert.equal(ready.object_manifest.length, 3);
  for (const output of ready.object_manifest) {
    assert.equal(output.url, config.publicOrigin + '/' + output.key);
    const downloaded = await fetch(output.url, {
      signal: AbortSignal.timeout(20000),
      redirect: 'error',
    });
    assert.equal(downloaded.status, 200);
    assert.equal(downloaded.headers.get('content-type'), 'image/webp');
    assert.equal(downloaded.headers.get('cache-control'), 'no-store');
    assert.equal((await downloaded.arrayBuffer()).byteLength, output.bytes);
  }
  record('https-r2-dev-public-generated-images', 'PASS', {
    variants: 3,
    cacheControl: 'no-store',
    tlsVerification: 'enabled',
  });
  const publicOriginal = await fetch(
    config.publicOrigin + '/staging/' + product + '/' + upload.media,
    { signal: AbortSignal.timeout(15000), redirect: 'error' },
  );
  assert.equal(publicOriginal.status, 404);
  record('unverified-original-not-in-public-bucket', 'PASS');
  const replay = await page.request.put(upload.uploadURL, { headers: upload.headers, data: image });
  assert.equal(replay.status(), 412);
  record('repeated-browser-capability-put-rejected', 'PASS', { httpStatus: 412 });
  const cross = await page.request.post(origin + '/api/admin/images/create-upload', {
    headers: { Origin: 'https://foreign.invalid' },
    data: { product, revision: 2, mime: 'image/png', bytes: image.length },
  });
  assert.equal(cross.status(), 403);
  record('cross-origin-mutation-rejected', 'PASS');
  const unauth = await browser.newContext();
  const denied = await unauth.request.post(origin + '/api/admin/images/complete-upload', {
    headers: { Origin: origin },
    data: { product, revision: 2, media: upload.media },
  });
  assert.equal(denied.status(), 401);
  await unauth.close();
  record('unauthenticated-completion-rejected', 'PASS');
  const bytes = Buffer.from('not-an-image');
  const badResponse = await page.request.post(origin + '/api/admin/images/create-upload', {
    headers: { Origin: origin },
    data: { product, revision: 2, mime: 'image/png', bytes: bytes.length },
  });
  assert.equal(badResponse.status(), 200);
  const bad = await badResponse.json();
  sessions.push({ ...bad, product });
  record('invalid-file-session', 'INFO');
  const put = await page.evaluate(
    async ({ upload, bytes }) => {
      const result = await fetch(upload.uploadURL, {
        method: 'PUT',
        headers: upload.headers,
        body: new Blob([new Uint8Array(bytes)], { type: 'image/png' }),
      });
      return result.status;
    },
    { upload: bad, bytes: [...bytes] },
  );
  assert.equal(put, 200);
  const badComplete = await page.request.post(origin + '/api/admin/images/complete-upload', {
    headers: { Origin: origin },
    data: { product, revision: 2, media: bad.media },
  });
  assert.equal(badComplete.status(), 422);
  const badRow = (
    await db.query('select upload_status,object_manifest from public.product_media where id=$1', [
      bad.media,
    ])
  ).rows[0];
  assert.equal(badRow.upload_status, 'failed');
  assert.deepEqual(badRow.object_manifest, []);
  record('actual-browser-invalid-image-rejected-before-promotion', 'PASS');
  await page.screenshot({ path: 'docs/verification/r2-local-editor.png', fullPage: true });
} catch (error) {
  record('local-integration', 'FAIL', {
    error: error.name,
    code: /^[A-Z0-9_]+$/.test(error.code) ? error.code : null,
  });
  process.exitCode = 1;
} finally {
  // Retire through the existing authenticated application workflow; retain history.
  for (const product of productIds) {
    try {
      const rows = (
        await db.query(
          'select id,upload_status from public.product_media where product_id=$1 and retired_at is null',
          [product],
        )
      ).rows;
      for (const media of rows) {
        const revision = (
          await db.query('select revision from public.products where id=$1', [product])
        ).rows[0].revision;
        const detached = await page.request.post(origin + `/api/admin/products/${product}/assets`, {
          headers: { Origin: origin },
          data: { media: media.id, revision: Number(revision), operation: 'detach' },
        });
        assert.equal(detached.status(), 200);
      }
      record('authenticated-detach-preserves-history', 'PASS');
    } catch (error) {
      record('authenticated-detach', 'FAIL', { error: error.name });
      process.exitCode = 1;
    }
  }
  // Recover all issued sessions even if the browser failed before returning a response.
  const media = productIds.length
    ? (
        await db.query(
          'select id,product_id,staging_key,object_manifest,upload_expires_at from public.product_media where product_id=any($1::uuid[])',
          [productIds],
        )
      ).rows
    : [];
  const deadline = Math.max(
    0,
    ...media.map((m) => new Date(m.upload_expires_at).getTime() + 600000),
  );
  if (browser) await browser.close();
  while (Date.now() < deadline) {
    console.log(
      JSON.stringify({
        check: 'upload-capability-cleanup-safety-window',
        remainingSeconds: Math.ceil((deadline - Date.now()) / 1000),
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, Math.min(45000, deadline - Date.now())));
  }
  for (let attempt = 0; media.length && attempt < media.length * 4 + 4; attempt++) {
    const pending = await db.query(
      'select count(*)::int n from private.outbox_events where entity_id=any($1::uuid[]) and completed_at is null',
      [media.map((m) => m.id)],
    );
    if (!pending.rows[0].n) break;
    try {
      const response = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/functions/v1/catalog-worker', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + env.CATALOG_WORKER_SECRET },
        signal: AbortSignal.timeout(90000),
      });
      assert.equal(response.status, 200);
      const outcome = await response.json();
      record('local-edge-cleanup-invocation', outcome.failed ? 'FAIL' : 'PASS', outcome);
      if (outcome.failed) {
        process.exitCode = 1;
        break;
      }
    } catch (error) {
      record('local-edge-cleanup', 'FAIL', { error: error.name });
      process.exitCode = 1;
      break;
    }
  }
  for (const row of media) {
    for (const object of [
      { bucket: config.stagingBucket, key: row.staging_key },
      ...row.object_manifest.map((o) => ({ bucket: config.publicBucket, key: o.key })),
    ]) {
      try {
        await store.client.send(new HeadObjectCommand({ Bucket: object.bucket, Key: object.key }), {
          abortSignal: AbortSignal.timeout(15000),
        });
        record('object-cleanup-confirmation', 'FAIL', {
          scope: object.bucket === config.stagingBucket ? 'staging' : 'public',
          objectStillExists: true,
        });
        process.exitCode = 1;
      } catch (error) {
        const absent = error?.$metadata?.httpStatusCode === 404;
        record('object-cleanup-confirmation', absent ? 'PASS' : 'FAIL', {
          scope: object.bucket === config.stagingBucket ? 'staging' : 'public',
          httpStatus: error?.$metadata?.httpStatusCode ?? null,
        });
        if (!absent) process.exitCode = 1;
      }
    }
  }
  await db.end();
  store.client.destroy();
}
