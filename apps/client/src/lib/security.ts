import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

type SecurityEnv = Record<string, string | undefined>;
export const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];
const MAX_IDENTITIES = 5000;
const trustedProxyMode = (env: SecurityEnv) =>
  env.CLIENT_TRUSTED_PROXY && env.CLIENT_TRUSTED_PROXY !== 'auto'
    ? env.CLIENT_TRUSTED_PROXY
    : env.VERCEL === '1'
      ? 'vercel'
      : 'none';

export function equalSecret(supplied: string, expected: string) {
  if (supplied.length > 512 || !expected || expected.length > 512) return false;
  return timingSafeEqual(
    createHash('sha256').update(supplied).digest(),
    createHash('sha256').update(expected).digest(),
  );
}
export function purgeAuthorized(headers: Headers, secret: string | undefined) {
  return (
    !!secret &&
    secret.length >= 32 &&
    secret.length <= 256 &&
    equalSecret(headers.get('authorization') || '', `Bearer ${secret}`)
  );
}
export function proxyOriginAllowed(headers: Headers, env: SecurityEnv = process.env) {
  const mode = trustedProxyMode(env);
  if (!['none', 'vercel', 'cloudflare', 'nginx'].includes(mode)) return false;
  if (mode === 'vercel') return env.VERCEL === '1';
  if (mode === 'none') return true;
  const secret = env.CLIENT_PROXY_ORIGIN_SECRET;
  return (
    !!secret &&
    secret.length >= 32 &&
    equalSecret(headers.get('x-catalog-origin-key') || '', secret)
  );
}
export function trustedClientIdentity(
  headers: Headers,
  env: SecurityEnv = process.env,
): string | null {
  if (!proxyOriginAllowed(headers, env)) return null;
  const mode = trustedProxyMode(env);
  const header =
    mode === 'vercel'
      ? 'x-vercel-forwarded-for'
      : mode === 'cloudflare'
        ? 'cf-connecting-ip'
        : mode === 'nginx'
          ? 'x-real-ip'
          : null;
  if (!header) return null;
  const raw = headers.get(header)?.trim();
  if (!raw || raw.length > 64 || !isIP(raw)) return null;
  const normalized = isIP(raw) === 6 ? new URL(`http://[${raw}]`).hostname : raw;
  return createHash('sha256').update(normalized).digest('hex');
}

// Best-effort burst protection for ONE running process. Hosting/WAF enforcement
// is required across replicas, regions, restarts and direct Supabase requests.
export class BurstLimiter {
  private readonly entries = new Map<string, { count: number; expires: number }>();
  constructor(private readonly capacity = MAX_IDENTITIES) {}
  get size() {
    return this.entries.size;
  }
  consume(key: string, limit: number, windowMs: number, now = Date.now()) {
    let record = this.entries.get(key);
    if (record && record.expires <= now) {
      this.entries.delete(key);
      record = undefined;
    }
    if (!record) {
      if (this.entries.size >= this.capacity) {
        for (const [entryKey, value] of this.entries)
          if (value.expires <= now) this.entries.delete(entryKey);
      }
      if (this.entries.size >= this.capacity)
        return { allowed: false, remaining: 0, retryAfter: Math.ceil(windowMs / 1000) };
      record = { count: 0, expires: now + windowMs };
      this.entries.set(key, record);
    }
    const retryAfter = Math.max(1, Math.ceil((record.expires - now) / 1000));
    if (record.count >= limit) return { allowed: false, remaining: 0, retryAfter };
    record.count++;
    return { allowed: true, remaining: limit - record.count, retryAfter };
  }
}
export function requestBudget(path: string, authenticatedPurge: boolean) {
  if (path === '/api/catalog/revalidate' && authenticatedPurge)
    return { key: 'purge', global: 30, individual: 10 };
  if (path === '/_next/image') return { key: 'images', global: 2400, individual: 240 };
  return { key: 'read', global: 1200, individual: 120 };
}
export function invalidApiQuery(path: string, params: URLSearchParams) {
  let allowed: string[];
  if (path === '/api/catalog/products')
    allowed = ['category', 'brand', 'q', 'featured', 'new', 'page', 'pageSize', 'sort', 'asc'];
  else if (path === '/api/catalog/documents') allowed = ['type', 'q', 'page', 'pageSize'];
  else if (path === '/api/catalog/categories') allowed = ['tree'];
  else if (path.startsWith('/api/catalog/')) allowed = [];
  else return false;
  const seen = new Set<string>();
  for (const [key, value] of params) {
    if (!allowed.includes(key) || seen.has(key)) return true;
    seen.add(key);
    const max = key === 'q' ? 80 : ['category', 'brand'].includes(key) ? 180 : 40;
    if (value.length > max || /[\u0000-\u001f\u007f]/.test(value)) return true;
    if (['category', 'brand'].includes(key) && value && !/^[a-z0-9_-]+$/i.test(value)) return true;
    if (['featured', 'new', 'asc', 'tree'].includes(key) && !['true', 'false', ''].includes(value))
      return true;
    if (
      key === 'sort' &&
      ![
        'name',
        'updated_at',
        'published_at',
        'name_asc',
        'name_desc',
        'updated_at_desc',
        'published_at_desc',
      ].includes(value)
    )
      return true;
  }
  return false;
}
