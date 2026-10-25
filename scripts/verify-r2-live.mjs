// Explicitly invoked diagnostics only. Never imported by application code.
// Do not print credentials, connection strings, signed URLs or raw provider errors.
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { R2Store, readR2Config, cleanupR2Media } from '../packages/storage/src/index.ts';

const env = parseEnv(fs.readFileSync('apps/admin/.env.local', 'utf8'));
const requireStorage = createRequire(new URL('../packages/storage/package.json', import.meta.url));
const { HeadBucketCommand, GetBucketCorsCommand, HeadObjectCommand } =
  requireStorage('@aws-sdk/client-s3');
const report = {
  date: new Date().toISOString(),
  productionDatabaseWrites: false,
  infrastructureChanges: false,
  checks: [],
};
function result(check, status, detail = {}) {
  const row = { check, status, ...detail };
  report.checks.push(row);
  console.log(JSON.stringify(row));
  fs.mkdirSync('docs/verification', { recursive: true });
  fs.writeFileSync(
    env.R2_ENVIRONMENT === 'development'
      ? 'docs/verification/r2-development-connectivity.json'
      : 'docs/verification/r2-live-results.json',
    JSON.stringify(report, null, 2) + '\n',
  );
}
function safeError(error) {
  const name = String(error?.name ?? 'Error');
  return {
    error: /^[A-Za-z0-9_]+$/.test(name) ? name : 'Error',
    httpStatus: error?.$metadata?.httpStatusCode ?? null,
  };
}
let config;
try {
  config = readR2Config({
    ...env,
    R2_STAGING_BUCKET: env.R2_STAGING_BUCKET || env.R2_UPLOAD_BUCKET,
    NODE_ENV: 'production',
  });
  if (
    config.stagingBucket !== 'ann-traders-uploads-private' ||
    config.publicBucket !== 'ann-traders-product-images'
  )
    throw new Error('UnexpectedBuckets');
  result('diagnostic-config', 'PASS', {
    stagingAliasUsed: !env.R2_STAGING_BUCKET,
    region: 'auto',
    endpointMatchesAccount: true,
    publicDelivery: config.publicOrigin.endsWith('.r2.dev') ? 'r2.dev' : 'custom domain',
    environment: config.environment,
    purgeMode: config.purgeMode,
  });
} catch (error) {
  result('diagnostic-config', 'FAIL', safeError(error));
  process.exit(1);
}
const store = new R2Store(config);
const origins = [
  ...new Set([env.APP_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'].filter(Boolean)),
];
const product = randomUUID(),
  media = randomUUID(),
  token = randomUUID();
const stagingKey = `staging/${product}/${media}`;
report.testScope = { product, media, token, stagingKey };
async function request(url, options = {}) {
  return fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(20000) });
}
let accessible = true;
for (const [label, bucket] of [
  ['staging', config.stagingBucket],
  ['public', config.publicBucket],
]) {
  try {
    await store.client.send(new HeadBucketCommand({ Bucket: bucket }), {
      abortSignal: AbortSignal.timeout(15000),
    });
    result(`${label}-bucket-connectivity`, 'PASS');
  } catch (error) {
    result(`${label}-bucket-connectivity`, 'FAIL', safeError(error));
    accessible = false;
  }
}
try {
  const cors = await store.client.send(new GetBucketCorsCommand({ Bucket: config.stagingBucket }), {
    abortSignal: AbortSignal.timeout(15000),
  });
  result('staging-cors-policy-read', 'PASS', {
    ruleCount: cors.CORSRules?.length ?? 0,
    wildcardOrigins: Boolean(cors.CORSRules?.some((r) => r.AllowedOrigins?.includes('*'))),
    wildcardHeaders: Boolean(cors.CORSRules?.some((r) => r.AllowedHeaders?.includes('*'))),
  });
} catch (error) {
  result('staging-cors-policy-read', 'UNVERIFIED', {
    ...safeError(error),
    note: 'Object-scoped credentials may intentionally lack bucket configuration access.',
  });
}
// OPTIONS neither creates an object nor exposes a signed URL in output.
for (const origin of [...origins, 'https://ann-r2-probe.invalid']) {
  try {
    const response = await request(`${config.endpoint}/${config.stagingBucket}/${stagingKey}`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'content-type,if-none-match',
      },
    });
    const allow = response.headers.get('access-control-allow-origin');
    const methods = response.headers.get('access-control-allow-methods') ?? '';
    const headers = response.headers.get('access-control-allow-headers')?.toLowerCase() ?? '';
    const allowed =
      response.ok &&
      (allow === origin || allow === '*') &&
      methods.includes('PUT') &&
      ['content-type', 'if-none-match'].every((h) => headers.includes(h) || headers === '*');
    result(
      `cors:${origin}`,
      origin.endsWith('.invalid')
        ? !allowed && allow !== '*'
          ? 'PASS'
          : 'FAIL'
        : allowed && allow !== '*'
          ? 'PASS'
          : 'FAIL',
      {
        httpStatus: response.status,
        originAllowed: allowed,
        wildcard: allow === '*',
        requiredHeadersAllowed: ['content-type', 'if-none-match'].every(
          (h) => headers.includes(h) || headers === '*',
        ),
      },
    );
  } catch (error) {
    result(`cors:${origin}`, 'FAIL', safeError(error));
  }
}
// Only GET requests against hosted Supabase. Never call mutating RPCs here.
const supabaseUrl = env.url || env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.service_role_key || env.SUPABASE_SERVICE_ROLE_KEY;
try {
  const base = new URL(supabaseUrl);
  if (base.protocol !== 'https:' || !base.hostname.endsWith('.supabase.co'))
    throw new Error('UnexpectedSupabaseHost');
  if (!serviceKey) throw new Error('MissingServiceRoleKey');
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const response = await request(`${base.origin}/rest/v1/`, {
    headers: { ...headers, Accept: 'application/openapi+json' },
  });
  if (!response.ok) result('hosted-supabase-schema-read', 'FAIL', { httpStatus: response.status });
  else {
    const schema = await response.json();
    const rpcs = [
      'r2_create_upload',
      'r2_claim_upload',
      'r2_plan_promotion',
      'r2_finish_upload',
      'r2_fail_upload',
      'r2_prepare_cleanup',
    ];
    const missingRpcs = rpcs.filter((rpc) => !schema.paths?.[`/rpc/${rpc}`]);
    result('hosted-supabase-r2-rpcs', missingRpcs.length ? 'FAIL' : 'PASS', {
      missingRpcs,
      productMediaTableExposed: Boolean(schema.paths?.['/product_media']),
      usedDiagnosticAliases: !env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY,
    });
    const columns = [
      'staging_key',
      'staging_bucket',
      'public_bucket',
      'delivery_origin',
      'object_manifest',
      'verification_token',
      'verified_at',
      'retired_at',
    ];
    const query = await request(
      `${base.origin}/rest/v1/product_media?select=${columns.join(',')}&limit=0`,
      { headers },
    );
    const errorBody = query.ok ? null : await query.json().catch(() => null);
    result('hosted-supabase-r2-columns', query.ok ? 'PASS' : 'FAIL', {
      httpStatus: query.status,
      code: /^[A-Z0-9]+$/.test(errorBody?.code) ? errorBody.code : null,
    });
  }
} catch (error) {
  result('hosted-supabase-schema-read', 'FAIL', safeError(error));
}

if (!process.argv.includes('--objects')) {
  store.client.destroy();
  process.exit(0);
}
if (!accessible) {
  result('object-tests', 'BLOCKED', {
    note: 'Bucket connectivity failed; no object writes attempted.',
  });
  store.client.destroy();
  process.exit(1);
}
const requireAdmin = createRequire(new URL('../apps/admin/package.json', import.meta.url));
const sharp = requireAdmin('sharp');
const ts = createRequire(import.meta.url)('typescript');
// Transpile the actual verifier for Node, preserving its implementation unchanged.
const verifierSource = fs.readFileSync('apps/admin/src/lib/verify-image.ts', 'utf8');
const verifierCode = ts
  .transpileModule(verifierSource, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  })
  .outputText.replace("from 'sharp'", `from '${pathToFileURL(requireAdmin.resolve('sharp')).href}'`)
  .replace(
    "from './provider'",
    `from '${new URL('../apps/admin/src/lib/provider.ts', import.meta.url).href}'`,
  );
const { verifyImageBytes } = await import(
  'data:text/javascript;base64,' + Buffer.from(verifierCode).toString('base64')
);
const created = [];
let capabilitySafeAfter = 0;
let db;
const journalFile = '.local-r2/r2-live-cleanup.json';
function journal() {
  fs.mkdirSync('.local-r2', { recursive: true });
  // No credentials or capability URLs. Recovery is restricted to these exact unique keys.
  fs.writeFileSync(
    journalFile,
    JSON.stringify(
      { product, media, objects: created, capabilitySafeAfter, customDomainFetched: false },
      null,
      2,
    ),
  );
}
async function expectSqlError(query, expectedCode) {
  await db.query('savepoint diagnostic_expected_failure');
  try {
    await query();
    throw new Error('ExpectedSqlRejection');
  } catch (error) {
    await db.query('rollback to savepoint diagnostic_expected_failure');
    assert.equal(error.code, expectedCode);
  } finally {
    await db.query('release savepoint diagnostic_expected_failure');
  }
}
try {
  const localConnection = process.env.R2_PROBE_DATABASE_URL;
  if (localConnection) {
    const address = new URL(localConnection);
    assert.ok(['localhost', '127.0.0.1'].includes(address.hostname));
    const { Client } = createRequire(import.meta.url)('pg');
    db = new Client({ connectionString: localConnection });
    await db.connect();
    await db.query('begin');
    await db.query('insert into auth.users(id) values($1)', [token]);
    await db.query(
      "insert into public.admin_profiles(id,full_name,role) values($1,'Isolated R2 probe','editor')",
      [token],
    );
    await db.query(
      "insert into public.products(id,name,product_code,slug,product_type,status,created_by,updated_by) values($1,'Isolated R2 probe',$2,$2,'physical','draft',$3,$3)",
      [product, 'probe-' + product, token],
    );
  }
  const image = await sharp({
    create: { width: 1024, height: 768, channels: 3, background: '#28678b' },
  })
    .png()
    .toBuffer();
  if (db) {
    await db.query('select public.r2_create_upload($1,$2,1,$3,$4,$5,$6,$7,$8)', [
      token,
      product,
      media,
      'image/png',
      image.length,
      config.publicOrigin,
      config.stagingBucket,
      config.publicBucket,
    ]);
    await expectSqlError(
      () =>
        db.query('select public.r2_finish_upload($1,$2,1,$3,$4)', [
          token,
          product,
          media,
          randomUUID(),
        ]),
      '40001',
    );
    result('local-unverified-attachment-denied', 'PASS');
  }
  // Short diagnostic capability; never return its URL or persist it.
  const upload = await store.createUpload(stagingKey, 'image/png', image.length, 5);
  const signed = new URL(upload.uploadURL);
  const date = signed.searchParams.get('X-Amz-Date');
  const issuedAt = Date.parse(
    date.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z'),
  );
  const expiresAt = issuedAt + 5000;
  capabilitySafeAfter = expiresAt + 600000;
  created.push({ scope: 'staging', key: stagingKey });
  journal();
  const put = await request(upload.uploadURL, {
    method: 'PUT',
    headers: upload.headers,
    body: image,
  });
  assert.equal(put.status, 200);
  result('presigned-put-live-r2', 'PASS', {
    httpStatus: put.status,
    signedHeaders: signed.searchParams.get('X-Amz-SignedHeaders'),
    ttlSeconds: 5,
  });
  const repeated = await request(upload.uploadURL, {
    method: 'PUT',
    headers: upload.headers,
    body: image,
  });
  assert.equal(repeated.status, 412);
  result('repeated-put-rejected', 'PASS', { httpStatus: repeated.status });
  const privateGet = await request(`${config.endpoint}/${config.stagingBucket}/${stagingKey}`);
  const privateCode = (await privateGet.text()).match(/<Code>([A-Za-z0-9_]+)<\/Code>/)?.[1];
  assert.ok(
    privateGet.status >= 400 && !privateGet.headers.get('content-type')?.startsWith('image/'),
  );
  result('anonymous-staging-get-denied', 'PASS', {
    httpStatus: privateGet.status,
    xmlCode: privateCode ?? null,
  });
  // The anonymous S3 denial does not prove that no public bucket domain is attached.
  const staged = await store.readStaged(stagingKey, image.length, 'image/png');
  assert.equal(
    createHash('sha256').update(staged.bytes).digest('hex'),
    createHash('sha256').update(image).digest('hex'),
  );
  result('server-side-private-read', 'PASS', { bytesMatch: true });
  let lease = token;
  if (db) {
    const claim = await db.query('select public.r2_claim_upload($1,$2,1,$3) as session', [
      token,
      product,
      media,
    ]);
    lease = claim.rows[0].session.token;
  }
  const verified = await verifyImageBytes(
    staged.bytes,
    'image/png',
    image.length,
    `catalog/${product}/${media}/${lease}`,
    config.publicOrigin,
  );
  for (const [input, mime] of [
    [Buffer.from('not an image'), 'image/png'],
    [image, 'image/jpeg'],
  ]) {
    await assert.rejects(() =>
      verifyImageBytes(
        input,
        mime,
        input.length,
        `catalog/${product}/${media}/${lease}`,
        config.publicOrigin,
      ),
    );
  }
  result('actual-image-verifier', 'PASS', {
    width: verified.width,
    height: verified.height,
    outputs: verified.outputs.map((o) => ({
      kind: o.entry.kind,
      width: o.entry.width,
      height: o.entry.height,
      bytes: o.entry.bytes,
    })),
    invalidBytesRejected: true,
    wrongMimeRejected: true,
  });
  if (db)
    await db.query('select public.r2_plan_promotion($1,$2,$3,$4,$5,$6,$7)', [
      token,
      media,
      lease,
      JSON.stringify(verified.outputs.map((o) => o.entry)),
      verified.digest,
      verified.width,
      verified.height,
    ]);
  for (const output of verified.outputs) {
    created.push({ scope: 'catalog', key: output.entry.key });
    journal();
    await store.putVerified(output.entry, output.bytes);
    const head = await store.client.send(
      new HeadObjectCommand({ Bucket: config.publicBucket, Key: output.entry.key }),
      { abortSignal: AbortSignal.timeout(15000) },
    );
    assert.equal(head.ContentType, 'image/webp');
    assert.equal(head.ContentLength, output.bytes.length);
    assert.equal(
      head.CacheControl,
      config.environment === 'development' ? 'no-store' : 'public, max-age=31536000, immutable',
    );
    assert.equal(head.Metadata.sha256, output.entry.sha256);
  }
  result('promotion-and-immutable-metadata', 'PASS', { outputs: 3, customDomainFetched: false });
  // Check custom-domain reachability using a missing key only; never cache test image bytes.
  try {
    const head = await request(`${config.publicOrigin}/catalog/${product}/probe-missing.webp`, {
      method: 'HEAD',
    });
    result('custom-domain-missing-object', head.status === 404 ? 'PASS' : 'UNVERIFIED', {
      httpStatus: head.status,
      deliveryOfPromotedBytes: 'not tested without CDN purge configuration',
    });
  } catch (error) {
    result('custom-domain-reachability', 'FAIL', safeError(error));
  }
  if (db) {
    const attached = await db.query('select public.r2_finish_upload($1,$2,1,$3,$4) as revision', [
      token,
      product,
      media,
      lease,
    ]);
    assert.equal(Number(attached.rows[0].revision), 2);
    const row = (
      await db.query(
        'select upload_status,is_primary,delivery_url,object_manifest from public.product_media where id=$1',
        [media],
      )
    ).rows[0];
    assert.equal(row.upload_status, 'ready');
    assert.equal(row.is_primary, true);
    assert.equal(row.object_manifest.length, 3);
    result('local-sql-verified-media-attachment', 'PASS', {
      hostedDatabase: false,
      transactionWillRollback: true,
    });
    await db.query("select public.product_media_action($1,2,$2,'detach','')", [product, media]);
    assert.equal(
      (await db.query('select upload_status from public.product_media where id=$1', [media]))
        .rows[0].upload_status,
      'retired',
    );
    result('local-sql-media-detach-retains-history', 'PASS');
    await expectSqlError(() => db.query('select public.r2_prepare_cleanup($1)', [media]), 'P0001');
    result('local-sql-cleanup-capability-fence', 'PASS');
    // Local fixture clock only: exercise the cleanup return contract without changing live capability timing.
    await db.query(
      "update public.product_media set upload_expires_at=now()-interval '16 minutes' where id=$1",
      [media],
    );
    const plan = (await db.query('select public.r2_prepare_cleanup($1) as plan', [media])).rows[0]
      .plan;
    const bucketNamesPresent =
      plan.staging_bucket === config.stagingBucket && plan.public_bucket === config.publicBucket;
    result('local-sql-cleanup-plan-contract', bucketNamesPresent ? 'PASS' : 'FAIL', {
      stagingBucketPresent: Boolean(plan.staging_bucket),
      publicBucketPresent: Boolean(plan.public_bucket),
      publicObjects: plan.objects.length,
    });
    if (!bucketNamesPresent) {
      await assert.rejects(
        () =>
          cleanupR2Media(store, plan, async () => {
            throw new Error('UnexpectedPurge');
          }),
        /Cleanup configuration mismatch/,
      );
      result('cleanup-fails-closed-on-incomplete-plan', 'PASS');
    }
  } else
    result('local-sql-media-attachment', 'UNVERIFIED', {
      note: 'No isolated local PostgreSQL connection supplied.',
    });
  const wait = Math.max(0, expiresAt + 1500 - Date.now());
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  const expired = await request(upload.uploadURL, {
    method: 'PUT',
    headers: upload.headers,
    body: image,
  });
  result('expired-presigned-put', expired.status === 403 ? 'PASS' : 'FAIL', {
    httpStatus: expired.status,
  });
} catch (error) {
  result('object-lifecycle', 'FAIL', safeError(error));
  process.exitCode = 1;
} finally {
  if (db) {
    try {
      await db.query('rollback');
      result('local-fixture-rollback', 'PASS');
    } catch (error) {
      result('local-fixture-rollback', 'FAIL', safeError(error));
    }
    await db.end();
  }
  // Never erase a staging object while the same capability could create it again.
  while (created.some((o) => o.scope === 'staging') && Date.now() < capabilitySafeAfter) {
    const remaining = Math.ceil((capabilitySafeAfter - Date.now()) / 1000);
    console.log(JSON.stringify({ check: 'cleanup-safety-wait', remainingSeconds: remaining }));
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(45000, capabilitySafeAfter - Date.now())),
    );
  }
  for (const object of [...created].reverse()) {
    try {
      assert.ok(
        object.key.startsWith(`staging/${product}/${media}`) ||
          object.key.startsWith(`catalog/${product}/${media}/`),
      );
      await store.deleteObject(object.scope, object.key);
      try {
        await store.client.send(
          new HeadObjectCommand({
            Bucket: object.scope === 'staging' ? config.stagingBucket : config.publicBucket,
            Key: object.key,
          }),
          { abortSignal: AbortSignal.timeout(15000) },
        );
        throw new Error('ObjectStillExists');
      } catch (error) {
        if (error?.$metadata?.httpStatusCode !== 404) throw error;
      }
      created.splice(created.indexOf(object), 1);
      journal();
      result(`cleanup:${object.scope}:${object.key.split('/').at(-1)}`, 'PASS', {
        authenticatedHeadAfterDelete: 404,
      });
    } catch (error) {
      result('test-object-cleanup', 'FAIL', safeError(error));
      process.exitCode = 1;
    }
  }
  result('test-object-cleanup-summary', created.length ? 'FAIL' : 'PASS', {
    remainingObjects: created.length,
    publicBytesFetchedViaCdn: false,
  });
  store.client.destroy();
}
