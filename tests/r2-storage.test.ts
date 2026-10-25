import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import {
  R2Store,
  readR2Config,
  cleanupR2Media,
  assertKey,
  type ManifestEntry,
  purgeImageUrls,
  resolveMediaDelivery,
} from '../packages/storage/src';
// Protocol double is shared by unit/integration and browser suites.
// @ts-expect-error JavaScript fixture intentionally has no generated declaration.
import { createMockR2Server, verifyPresigned, testCredentials } from './e2e/mock-r2.mjs';
const media = '20000000-0000-4000-8000-000000000001',
  product = '20000000-0000-4000-8000-000000000002',
  token = '20000000-0000-4000-8000-000000000003';
const fixture = createMockR2Server();
let store: R2Store;
let origin: string;
beforeAll(async () => {
  await new Promise<void>((resolve) => fixture.server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${fixture.server.address().port}`;
  store = new R2Store({
    environment: 'production',
    purgeMode: 'cloudflare',
    previousPublicOrigins: [],
    endpoint: origin,
    publicOrigin: origin,
    stagingBucket: 'private-stage',
    publicBucket: 'public-images',
    ...testCredentials,
  });
});

describe('explicit R2 development delivery', () => {
  const env = {
    R2_ACCOUNT_ID: 'a'.repeat(32),
    R2_ACCESS_KEY_ID: 'key',
    R2_SECRET_ACCESS_KEY: 'secret',
    R2_STAGING_BUCKET: 'private-stage',
    R2_PUBLIC_BUCKET: 'public-images',
    R2_PUBLIC_BASE_URL: 'https://pub-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.dev',
    R2_ENVIRONMENT: 'development',
    R2_CDN_PURGE_MODE: 'disabled',
    APP_ORIGIN: 'http://localhost:3000',
  };
  it('accepts managed HTTPS development delivery explicitly, including local production builds', () => {
    expect(readR2Config({ ...env, NODE_ENV: 'production' })).toMatchObject({
      environment: 'development',
      purgeMode: 'disabled',
    });
    expect(() => readR2Config({ ...env, R2_ENVIRONMENT: 'production' })).toThrow();
    expect(() => readR2Config({ ...env, R2_ENVIRONMENT: '' })).toThrow();
    expect(() => readR2Config({ ...env, APP_ORIGIN: 'https://admin.example.com' })).toThrow(
      'loopback',
    );
  });
  it('never allows disabled purge for production or a cacheable custom domain', () => {
    expect(() =>
      readR2Config({
        ...env,
        R2_ENVIRONMENT: 'production',
        R2_PUBLIC_BASE_URL: 'https://images.example.com',
      }),
    ).toThrow('disabled');
    expect(() =>
      readR2Config({ ...env, R2_PUBLIC_BASE_URL: 'https://images.example.com' }),
    ).toThrow('disabled');
    expect(() => readR2Config({ ...env, R2_CDN_PURGE_MODE: 'typo' })).toThrow();
  });
  it('keeps HTTPS, endpoint identity and separate private/public buckets mandatory', () => {
    expect(() =>
      readR2Config({
        ...env,
        R2_PUBLIC_BASE_URL: env.R2_PUBLIC_BASE_URL.replace('https:', 'http:'),
      }),
    ).toThrow('HTTPS');
    expect(() => readR2Config({ ...env, R2_STAGING_BUCKET: 'public-images' })).toThrow();
    expect(() => readR2Config({ ...env, R2_ENDPOINT: 'https://foreign.example.com' })).toThrow();
  });
  it('skips the purge API only for explicitly disabled uncached development delivery', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      await purgeImageUrls(
        [`${env.R2_PUBLIC_BASE_URL}/catalog/${product}/${media}/${token}/detail.webp`],
        env,
      );
      expect(fetchSpy).not.toHaveBeenCalled();
      await expect(
        purgeImageUrls(
          [`https://foreign.example.com/catalog/${product}/${media}/${token}/detail.webp`],
          env,
        ),
      ).rejects.toThrow('Untrusted');
      await expect(
        purgeImageUrls(
          [`https://images.example.com/catalog/${product}/${media}/${token}/detail.webp`],
          {
            ...env,
            R2_ENVIRONMENT: 'production',
            R2_CDN_PURGE_MODE: 'cloudflare',
            R2_PUBLIC_BASE_URL: 'https://images.example.com',
          },
        ),
      ).rejects.toThrow('missing');
    } finally {
      fetchSpy.mockRestore();
    }
  });
  it('serves existing immutable keys on a new domain without mutating history or legacy Images URLs', () => {
    const key = `catalog/${product}/${media}/${token}/detail.webp`;
    const row = {
      provider: 'r2',
      delivery_url: env.R2_PUBLIC_BASE_URL + '/' + key,
      object_manifest: [{ kind: 'detail', key, url: env.R2_PUBLIC_BASE_URL + '/' + key }],
    };
    const updated = resolveMediaDelivery(row, 'https://images.example.com');
    expect(updated.delivery_url).toBe('https://images.example.com/' + key);
    expect(updated.object_manifest[0].key).toBe(key);
    expect(row.delivery_url).toContain('.r2.dev');
    const legacy = {
      provider: 'cloudflare_images',
      delivery_url: 'https://imagedelivery.net/hash/id/detail',
    };
    expect(resolveMediaDelivery(legacy, 'https://images.example.com')).toBe(legacy);
    expect(() =>
      resolveMediaDelivery(
        { ...row, object_manifest: [{ kind: 'detail', key: '../private.pdf' }] },
        'https://images.example.com',
      ),
    ).toThrow();
  });
  it('writes development public images without browser caching', async () => {
    const id = crypto.randomUUID();
    const devStore = new R2Store({ ...store.config, environment: 'development' }, store.client);
    const key = `catalog/${product}/${id}/${token}/detail.webp`;
    await devStore.putVerified(
      {
        kind: 'detail',
        key,
        url: origin + '/' + key,
        width: 100,
        height: 100,
        bytes: 4,
        sha256: 'a'.repeat(64),
      },
      new TextEncoder().encode('test'),
    );
    // Verify through the HTTP provider contract rather than inspecting adapter fields.
    const response = await fetch(origin + '/' + key);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    fixture.server.close((e: Error) => (e ? reject(e) : resolve())),
  );
});
describe('R2 presigned conditional uploads', () => {
  it('signs exact type, length and write-once precondition; repeated PUT cannot overwrite', async () => {
    const upload = await store.createUpload(`staging/${product}/${media}`, 'image/png', 4);
    const url = new URL(upload.uploadURL);
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe(
      'content-length;content-type;host;if-none-match',
    );
    const first = await fetch(upload.uploadURL, {
      method: 'PUT',
      headers: upload.headers,
      body: 'test',
    });
    expect(first.status).toBe(200);
    const repeat = await fetch(upload.uploadURL, {
      method: 'PUT',
      headers: upload.headers,
      body: 'evil',
    });
    expect(repeat.status).toBe(412);
    const read = await store.readStaged(`staging/${product}/${media}`, 4, 'image/png');
    expect(new TextDecoder().decode(read.bytes)).toBe('test');
  });
  it('admits at most one concurrent PUT', async () => {
    const id = crypto.randomUUID(),
      upload = await store.createUpload(`staging/${product}/${id}`, 'image/png', 4);
    const responses = await Promise.all(
      [1, 2].map(() =>
        fetch(upload.uploadURL, { method: 'PUT', headers: upload.headers, body: 'test' }),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([200, 412]);
  });
  it('rejects tampered MIME or omitted conditional header', async () => {
    const upload = await store.createUpload(
      `staging/${product}/${crypto.randomUUID()}`,
      'image/png',
      4,
    );
    expect(
      (
        await fetch(upload.uploadURL, {
          method: 'PUT',
          headers: { ...upload.headers, 'Content-Type': 'text/html' },
          body: 'test',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(upload.uploadURL, {
          method: 'PUT',
          headers: { 'Content-Type': 'image/png' },
          body: 'test',
        })
      ).status,
    ).toBe(403);
  });
  it('expires capabilities and rejects excessive requested TTL', async () => {
    const upload = await store.createUpload(
      `staging/${product}/${crypto.randomUUID()}`,
      'image/png',
      4,
      1,
    );
    expect(() =>
      verifyPresigned(
        new URL(upload.uploadURL),
        { 'content-length': '4', 'content-type': 'image/png', 'if-none-match': '*' },
        'PUT',
        Date.now() + 5000,
      ),
    ).toThrow('Expired');
    await expect(
      store.createUpload(`staging/${product}/${media}`, 'image/png', 4, 3600),
    ).rejects.toThrow();
  });
  it('does not allow anonymous staging reads or public writes', async () => {
    expect((await fetch(`${origin}/private-stage/staging/${product}/${media}`)).status).toBe(403);
    expect(
      (await fetch(`${origin}/public-images/catalog/x`, { method: 'PUT', body: 'evil' })).status,
    ).toBe(403);
  });
  it('bounds actual object type and size', async () => {
    await expect(store.readStaged(`staging/${product}/${media}`, 3, 'image/png')).rejects.toThrow(
      'declaration',
    );
    await expect(store.readStaged(`staging/${product}/${media}`, 4, 'image/jpeg')).rejects.toThrow(
      'declaration',
    );
  });
  it('rejects path traversal and unsupported/oversized declarations', async () => {
    expect(() => assertKey('../secret', 'staging')).toThrow();
    await expect(
      store.createUpload(`staging/${product}/${media}`, 'image/svg+xml', 4),
    ).rejects.toThrow();
    await expect(
      store.createUpload(`staging/${product}/${media}`, 'image/png', 10485761),
    ).rejects.toThrow();
  });
  it('requires separate buckets and HTTPS custom delivery in production', () => {
    const env = {
      R2_ACCOUNT_ID: 'a'.repeat(32),
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_STAGING_BUCKET: 'private-stage',
      R2_PUBLIC_BUCKET: 'public-images',
      R2_PUBLIC_BASE_URL: 'https://images.example.com',
      NODE_ENV: 'production',
    };
    expect(readR2Config(env).publicOrigin).toBe('https://images.example.com');
    expect(() => readR2Config({ ...env, R2_STAGING_BUCKET: 'public-images' })).toThrow();
    expect(() => readR2Config({ ...env, R2_PUBLIC_BASE_URL: 'https://foo.r2.dev' })).toThrow();
    expect(() => readR2Config({ ...env, R2_ENDPOINT: 'http://127.0.0.1:9' })).toThrow();
  });
});
describe('R2 cleanup recovery', () => {
  const entry = (): ManifestEntry => ({
    kind: 'detail',
    key: `catalog/${product}/${media}/${token}/detail.webp`,
    url: `${origin}/catalog/${product}/${media}/${token}/detail.webp`,
    width: 100,
    height: 100,
    bytes: 4,
    sha256: 'a'.repeat(64),
  });
  it('retries failed purge safely; does not delete staging before purge succeeds', async () => {
    const object = entry();
    await store.putVerified(object, new TextEncoder().encode('test'));
    const plan = {
      origin,
      staging_bucket: 'private-stage',
      public_bucket: 'public-images',
      staging_key: `staging/${product}/${media}`,
      objects: [object],
    };
    await expect(
      cleanupR2Media(store, plan, async () => {
        throw new Error('purge outage');
      }),
    ).rejects.toThrow('purge outage');
    expect(fixture.objects.has(`private-stage/${plan.staging_key}`)).toBe(true);
    await cleanupR2Media(store, plan, async () => {});
    await cleanupR2Media(store, plan, async () => {});
    expect(fixture.objects.has(`private-stage/${plan.staging_key}`)).toBe(false);
  });
  it('propagates provider outages for durable retry', async () => {
    await fetch(`${origin}/__test/fault?enabled=true`);
    try {
      await expect(store.deleteObject('catalog', entry().key)).rejects.toThrow();
    } finally {
      await fetch(`${origin}/__test/fault?enabled=false`);
    }
  });
  it('cleans the same canonical key after an explicitly trusted delivery-domain cutover', async () => {
    const previous = 'https://previous-images.example.com';
    const rotated = new R2Store(
      { ...store.config, previousPublicOrigins: [previous] },
      store.client,
    );
    const object = { ...entry(), url: previous + '/' + entry().key };
    const purged: string[] = [];
    await cleanupR2Media(
      rotated,
      {
        origin: previous,
        staging_bucket: 'private-stage',
        public_bucket: 'public-images',
        staging_key: `staging/${product}/${media}`,
        objects: [object],
      },
      async (urls) => {
        purged.push(...urls);
      },
    );
    expect(purged.sort()).toEqual([origin + '/' + object.key, previous + '/' + object.key].sort());
  });
  it('rejects foreign cleanup URLs before deleting any object', async () => {
    await expect(
      cleanupR2Media(
        store,
        {
          origin,
          staging_bucket: 'private-stage',
          public_bucket: 'public-images',
          staging_key: `staging/${product}/${media}`,
          objects: [{ ...entry(), url: 'https://evil.test/x' }],
        },
        async () => {},
      ),
    ).rejects.toThrow('Untrusted');
  });
});
