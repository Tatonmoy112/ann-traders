// Infrastructure-only module: import through a server-only application boundary.
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const UPLOAD_TTL = 300;
export type R2Config = {
  environment: 'development' | 'production';
  purgeMode: 'disabled' | 'cloudflare';
  previousPublicOrigins: string[];
  endpoint: string;
  stagingBucket: string;
  publicBucket: string;
  publicOrigin: string;
  accessKeyId: string;
  secretAccessKey: string;
};
export type ManifestEntry = {
  key: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
  kind: 'thumbnail' | 'card' | 'detail';
};
export function readR2Config(env: Record<string, string | undefined>): R2Config {
  const required = (name: string) => {
    const value = env[name];
    if (!value) throw new Error(`Missing ${name}`);
    return value;
  };
  const account = required('R2_ACCOUNT_ID');
  const environment = env.R2_ENVIRONMENT || 'production';
  const purgeMode = env.R2_CDN_PURGE_MODE || 'cloudflare';
  if (!['development', 'production'].includes(environment))
    throw new Error('Invalid R2_ENVIRONMENT');
  if (!['disabled', 'cloudflare'].includes(purgeMode)) throw new Error('Invalid R2_CDN_PURGE_MODE');
  if (environment === 'development') {
    const admin = new URL(required('APP_ORIGIN'));
    if (
      !['http:', 'https:'].includes(admin.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(admin.hostname) ||
      admin.username ||
      admin.password ||
      admin.pathname !== '/' ||
      admin.search ||
      admin.hash
    )
      throw new Error('R2 development requires a loopback APP_ORIGIN');
  }
  if (!/^[a-f0-9]{32}$/.test(account)) throw new Error('Invalid R2 account ID');
  const expected = `https://${account}.r2.cloudflarestorage.com`;
  const endpoint = new URL(env.R2_ENDPOINT ?? expected),
    origin = new URL(required('R2_PUBLIC_BASE_URL'));
  const local = (u: URL) =>
    (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') &&
    u.protocol === 'http:' &&
    ['localhost', '127.0.0.1'].includes(u.hostname);
  if (endpoint.origin !== expected && !local(endpoint))
    throw new Error('R2 endpoint must match the configured account');
  for (const url of [endpoint, origin])
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/')
      throw new Error('Storage URLs must be bare origins');
  if (origin.protocol !== 'https:' && !local(origin))
    throw new Error('Public delivery requires HTTPS');
  if (origin.hostname.endsWith('.r2.cloudflarestorage.com'))
    throw new Error('S3 endpoints cannot deliver public images');
  if (origin.hostname === 'r2.dev' || origin.hostname.endsWith('.r2.dev')) {
    if (
      environment !== 'development' ||
      !/^pub-[a-z0-9]+\.r2\.dev$/.test(origin.hostname) ||
      origin.port
    )
      throw new Error('R2 public development URLs require explicit development mode');
  }
  if (
    purgeMode === 'disabled' &&
    (environment !== 'development' || (!origin.hostname.endsWith('.r2.dev') && !local(origin)))
  )
    throw new Error('CDN purge may be disabled only for uncached development delivery');
  const previousPublicOrigins = (env.R2_PREVIOUS_PUBLIC_BASE_URLS || '')
    .split(',')
    .filter(Boolean)
    .map((value) => {
      const url = new URL(value.trim());
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash ||
        url.hostname.endsWith('.r2.cloudflarestorage.com')
      )
        throw new Error('Invalid previous public origin');
      return url.origin;
    });
  const bucket = (name: string) => {
    const value = required(name);
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(value)) throw new Error(`Invalid ${name}`);
    return value;
  };
  const stagingBucket = bucket('R2_STAGING_BUCKET'),
    publicBucket = bucket('R2_PUBLIC_BUCKET');
  if (stagingBucket === publicBucket)
    throw new Error('Private staging and public delivery buckets must differ');
  return {
    environment: environment as R2Config['environment'],
    purgeMode: purgeMode as R2Config['purgeMode'],
    previousPublicOrigins,
    endpoint: endpoint.origin,
    stagingBucket,
    publicBucket,
    publicOrigin: origin.origin,
    accessKeyId: required('R2_ACCESS_KEY_ID'),
    secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
  };
}
export function publicImageUrl(origin: string, key: string) {
  assertKey(key, 'catalog');
  return `${origin}/${key}`;
}
// URLs are delivery hints. Persisted immutable keys remain authoritative across domain changes.
export function resolveMediaDelivery<
  T extends {
    provider?: string;
    delivery_url?: string | null;
    external_url?: string | null;
    object_manifest?: unknown;
  },
>(media: T, origin: string): T {
  if (media.provider !== 'r2') return media;
  if (!Array.isArray(media.object_manifest)) throw new Error('Invalid image manifest');
  const manifest = media.object_manifest.map((entry: ManifestEntry) => ({
    ...entry,
    url: publicImageUrl(origin, entry.key),
  }));
  const detail = manifest.find((entry) => entry.kind === 'detail');
  return {
    ...media,
    object_manifest: manifest,
    delivery_url: detail?.url ?? null,
    external_url: detail?.url ?? null,
  };
}
export function assertKey(key: string, scope: 'staging' | 'catalog') {
  const pattern =
    scope === 'staging'
      ? /^staging\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/
      : /^catalog\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/(thumbnail|card|detail)\.webp$/;
  if (!pattern.test(key)) throw new Error('Invalid storage key');
}
export class R2Store {
  readonly client: S3Client;
  constructor(
    readonly config: R2Config,
    client?: S3Client,
  ) {
    this.client =
      client ??
      new S3Client({
        endpoint: config.endpoint,
        region: 'auto',
        forcePathStyle: true,
        credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
        maxAttempts: 2,
      });
  }
  async createUpload(key: string, mime: string, bytes: number, expiresIn = UPLOAD_TTL) {
    assertKey(key, 'staging');
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(mime) ||
      !Number.isInteger(bytes) ||
      bytes < 1 ||
      bytes > MAX_IMAGE_BYTES ||
      expiresIn < 1 ||
      expiresIn > UPLOAD_TTL
    )
      throw new Error('Invalid upload declaration');
    const command = new PutObjectCommand({
      Bucket: this.config.stagingBucket,
      Key: key,
      ContentType: mime,
      ContentLength: bytes,
      IfNoneMatch: '*',
    });
    const uploadURL = await getSignedUrl(this.client, command, {
      expiresIn,
      signableHeaders: new Set(['content-type', 'content-length', 'if-none-match']),
    });
    return {
      uploadURL,
      method: 'PUT' as const,
      headers: { 'Content-Type': mime, 'If-None-Match': '*' },
      expiresIn,
    };
  }
  async readStaged(key: string, expectedBytes: number, expectedMime: string) {
    assertKey(key, 'staging');
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.stagingBucket, Key: key }),
      { abortSignal: AbortSignal.timeout(15000) },
    );
    const source = result.Body as unknown as
      (AsyncIterable<Uint8Array> & { destroy?: () => void }) | undefined;
    if (
      !result.Body ||
      result.ContentLength !== expectedBytes ||
      result.ContentLength > MAX_IMAGE_BYTES ||
      result.ContentType?.split(';')[0] !== expectedMime
    ) {
      source?.destroy?.();
      throw new Error('Stored object does not match the upload declaration');
    }
    const parts: Uint8Array[] = [];
    let size = 0;
    try {
      for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
        size += chunk.length;
        if (size > MAX_IMAGE_BYTES || size > expectedBytes)
          throw new Error('Object exceeds size limit');
        parts.push(chunk);
      }
    } finally {
      source?.destroy?.();
    }
    if (size !== expectedBytes) throw new Error('Incomplete staged object');
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.length;
    }
    return { bytes, etag: result.ETag ?? null };
  }
  async putVerified(entry: ManifestEntry, bytes: Uint8Array) {
    assertKey(entry.key, 'catalog');
    if (entry.url !== `${this.config.publicOrigin}/${entry.key}` || entry.bytes !== bytes.length)
      throw new Error('Invalid promotion manifest');
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.publicBucket,
        Key: entry.key,
        Body: bytes,
        ContentLength: bytes.length,
        ContentType: 'image/webp',
        CacheControl:
          this.config.environment === 'development'
            ? 'no-store'
            : 'public, max-age=31536000, immutable',
        IfNoneMatch: '*',
        Metadata: { sha256: entry.sha256 },
      }),
      { abortSignal: AbortSignal.timeout(15000) },
    );
  }
  async putMasterImage(key: string, bytes: Uint8Array, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.publicBucket,
        Key: key,
        Body: bytes,
        ContentLength: bytes.length,
        ContentType: contentType,
        CacheControl:
          this.config.environment === 'development'
            ? 'no-store'
            : 'public, max-age=31536000, immutable',
        IfNoneMatch: '*',
      }),
      { abortSignal: AbortSignal.timeout(15000) },
    );
  }
  async deleteObject(scope: 'staging' | 'catalog', key: string) {
    assertKey(key, scope);
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: scope === 'staging' ? this.config.stagingBucket : this.config.publicBucket,
        Key: key,
      }),
      { abortSignal: AbortSignal.timeout(15000) },
    );
  }
  async sweepOrphanStaging(maxAgeMinutes: number = 60) {
    const cutoff = Date.now() - maxAgeMinutes * 60 * 1000;
    const response = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.config.stagingBucket,
        Prefix: 'staging/',
      }),
      { abortSignal: AbortSignal.timeout(15000) },
    );

    const contents = response.Contents ?? [];
    const deletedKeys: string[] = [];
    let freedBytes = 0;

    for (const obj of contents) {
      if (!obj.Key || !obj.LastModified) continue;
      if (obj.LastModified.getTime() < cutoff) {
        try {
          await this.client.send(
            new DeleteObjectCommand({
              Bucket: this.config.stagingBucket,
              Key: obj.Key,
            }),
          );
          deletedKeys.push(obj.Key);
          freedBytes += obj.Size ?? 0;
        } catch {
          // ignore individual deletion errors to keep sweep resilient
        }
      }
    }

    return {
      scanned: contents.length,
      deleted: deletedKeys.length,
      freedBytes,
      deletedKeys,
    };
  }
}

export type CleanupPlan = {
  staging_key: string;
  staging_bucket: string;
  public_bucket: string;
  origin: string;
  objects: ManifestEntry[];
};
export async function cleanupR2Media(
  store: R2Store,
  plan: CleanupPlan,
  purge: (urls: string[]) => Promise<void>,
) {
  if (
    ![store.config.publicOrigin, ...store.config.previousPublicOrigins].includes(plan.origin) ||
    plan.staging_bucket !== store.config.stagingBucket ||
    plan.public_bucket !== store.config.publicBucket ||
    !Array.isArray(plan.objects) ||
    plan.objects.length > 3
  )
    throw new Error('Cleanup configuration mismatch');
  assertKey(plan.staging_key, 'staging');
  for (const object of plan.objects) {
    assertKey(object.key, 'catalog');
    if (object.url !== `${plan.origin}/${object.key}`) throw new Error('Untrusted cleanup URL');
  }
  // Authorization/reference checks and capability/lease fencing happen in the DB before this call.
  for (const object of plan.objects) await store.deleteObject('catalog', object.key);
  if (plan.objects.length)
    await purge([
      ...new Set(
        plan.objects.flatMap((o) =>
          [store.config.publicOrigin, plan.origin].map((origin) => publicImageUrl(origin, o.key)),
        ),
      ),
    ]);
  await store.deleteObject('staging', plan.staging_key);
}
export async function purgeImageUrls(urls: string[], env: Record<string, string | undefined>) {
  if (!urls.length) return;
  const config = readR2Config(env);
  for (const value of urls) {
    const url = new URL(value);
    if (
      ![config.publicOrigin, ...config.previousPublicOrigins].includes(url.origin) ||
      url.search ||
      url.hash
    )
      throw new Error('Untrusted purge URL');
    assertKey(url.pathname.slice(1), 'catalog');
  }
  if (config.purgeMode === 'disabled') {
    if (
      urls.some((value) => {
        const url = new URL(value);
        return (
          !url.hostname.endsWith('.r2.dev') && !['localhost', '127.0.0.1'].includes(url.hostname)
        );
      })
    )
      throw new Error('Cannot skip purge for a cached custom domain');
    return;
  }
  // Previous r2.dev URLs have no Cloudflare CDN cache to purge.
  urls = urls.filter((value) => !new URL(value).hostname.endsWith('.r2.dev'));
  if (!urls.length) return;
  const zone = env.CLOUDFLARE_ZONE_ID,
    token = env.CLOUDFLARE_CACHE_PURGE_TOKEN;
  if (!zone || !token || !/^[a-f0-9]{32}$/.test(zone))
    throw new Error('CDN purge configuration missing');
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: urls }),
    signal: AbortSignal.timeout(10000),
    redirect: 'error',
  });
  const result = (await response.json()) as { success?: boolean };
  if (!response.ok || !result.success) throw new Error('CDN purge failed');
}
