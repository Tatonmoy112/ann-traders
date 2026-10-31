import { describe, it, expect } from 'vitest';
import {
  BurstLimiter,
  invalidApiQuery,
  proxyOriginAllowed,
  purgeAuthorized,
  trustedClientIdentity,
} from '../apps/client/src/lib/security';
import { contentSecurityPolicy } from '../apps/client/src/lib/security-policy';
describe('client request security', () => {
  it('blocks bursts and resets exactly at the expiry boundary', () => {
    const limiter = new BurstLimiter();
    expect(limiter.consume('same', 2, 1000, 0).allowed).toBe(true);
    expect(limiter.consume('same', 2, 1000, 1).allowed).toBe(true);
    expect(limiter.consume('same', 2, 1000, 500)).toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfter: 1,
    });
    expect(limiter.consume('same', 2, 1000, 1000).allowed).toBe(true);
  });
  it('bounds memory without evicting live limits when identities churn', () => {
    const limiter = new BurstLimiter(2);
    limiter.consume('a', 1, 1000, 0);
    limiter.consume('b', 1, 1000, 0);
    expect(limiter.consume('c', 1, 1000, 1).allowed).toBe(false);
    expect(limiter.size).toBe(2);
    expect(limiter.consume('a', 1, 1000, 1).allowed).toBe(false);
    expect(limiter.consume('c', 1, 1000, 1000).allowed).toBe(true);
  });
  it('ignores caller-controlled forwarded headers by default', () => {
    const headers = new Headers({
      'x-forwarded-for': '1.2.3.4',
      'x-real-ip': '1.2.3.4',
      'cf-connecting-ip': '1.2.3.4',
    });
    expect(trustedClientIdentity(headers, {})).toBeNull();
    expect(trustedClientIdentity(headers, { CLIENT_TRUSTED_PROXY: 'vercel' })).toBeNull();
  });
  it('uses Vercel identity only within an explicitly selected Vercel deployment', () => {
    const env = { CLIENT_TRUSTED_PROXY: 'vercel', VERCEL: '1' };
    const first = trustedClientIdentity(new Headers({ 'x-vercel-forwarded-for': '1.2.3.4' }), env);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(
      trustedClientIdentity(new Headers({ 'x-vercel-forwarded-for': '1.2.3.4' }), { VERCEL: '1' }),
    ).toBe(first);
    expect(
      trustedClientIdentity(new Headers({ 'x-vercel-forwarded-for': '1.2.3.4, 5.6.7.8' }), env),
    ).toBeNull();
  });
  it('requires an authenticated origin proxy before trusting Cloudflare/nginx identity', () => {
    const env = { CLIENT_TRUSTED_PROXY: 'cloudflare', CLIENT_PROXY_ORIGIN_SECRET: 'a'.repeat(32) };
    const forged = new Headers({ 'cf-connecting-ip': '1.2.3.4' });
    expect(proxyOriginAllowed(forged, env)).toBe(false);
    expect(trustedClientIdentity(forged, env)).toBeNull();
    forged.set('x-catalog-origin-key', 'a'.repeat(32));
    expect(proxyOriginAllowed(forged, env)).toBe(true);
    expect(trustedClientIdentity(forged, env)).not.toBeNull();
    expect(proxyOriginAllowed(forged, { CLIENT_TRUSTED_PROXY: 'nginx' })).toBe(false);
    expect(proxyOriginAllowed(forged, { CLIENT_TRUSTED_PROXY: 'invalid' })).toBe(false);
  });
  it('normalizes equivalent IPv6 forms to the same identity', () => {
    const env = { CLIENT_TRUSTED_PROXY: 'vercel', VERCEL: '1' };
    const id = (value: string) =>
      trustedClientIdentity(new Headers({ 'x-vercel-forwarded-for': value }), env);
    expect(id('2001:0db8:0:0:0:0:0:1')).toBe(id('2001:db8::1'));
  });
  it('authenticates only complete, correctly bounded purge credentials', () => {
    const secret = 'a'.repeat(32);
    expect(purgeAuthorized(new Headers({ authorization: 'Bearer ' + secret }), secret)).toBe(true);
    expect(
      purgeAuthorized(new Headers({ authorization: 'Bearer ' + secret.slice(1) }), secret),
    ).toBe(false);
    expect(
      purgeAuthorized(new Headers({ authorization: 'Bearer ' + 'a'.repeat(10000) }), secret),
    ).toBe(false);
    expect(purgeAuthorized(new Headers(), undefined)).toBe(false);
    expect(purgeAuthorized(new Headers({ authorization: 'Bearer short' }), 'short')).toBe(false);
  });
  it.each([
    'q=a&q=b',
    'select=*',
    'q=' + 'a'.repeat(81),
    'brand=x%2Cname.eq.secret',
    'featured=maybe',
  ])('rejects ambiguous/oversized API input: %s', (query) => {
    expect(invalidApiQuery('/api/catalog/products', new URLSearchParams(query))).toBe(true);
  });
  it('retains existing safe pagination and search contracts', () => {
    expect(
      invalidApiQuery(
        '/api/catalog/products',
        new URLSearchParams('q=paper&page=NaN&pageSize=Infinity&sort=name_asc'),
      ),
    ).toBe(false);
    expect(invalidApiQuery('/products', new URLSearchParams('utm_source=mail'))).toBe(false);
  });
  it('sets a strict nonce-based script policy with eval limited to development', () => {
    const nonce = '0123456789abcdefghijklmn';
    const prod = contentSecurityPolicy(nonce, false, 'https://images.example.test', true);
    const scripts = prod.split(';').find((value) => value.includes('script-src'))!;
    expect(scripts).toContain("'nonce-" + nonce + "'");
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain('unsafe-inline');
    expect(scripts).not.toContain('unsafe-eval');
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain('upgrade-insecure-requests');
    expect(contentSecurityPolicy(nonce, true)).toContain("'unsafe-eval'");
    expect(() => contentSecurityPolicy('bad; script-src *', false)).toThrow();
  });
});
