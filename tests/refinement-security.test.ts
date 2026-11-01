import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { trustedMutationOrigin } from '../apps/admin/src/lib/request-security';
import { verifyCatalogEvent } from '../apps/client/src/lib/catalog-events';
import { technicalFilters } from '../apps/client/src/lib/catalog-contract';
import { serveCatalogDocument } from '../supabase/functions/catalog-document/handler';

describe('production refinement: origins, signed events and technical query inputs', () => {
  it.each([
    'https://evil.test/localhost',
    'https://localhost.evil.test',
    'https://other.vercel.app',
    'null',
    '',
  ])('rejects untrusted multipart origin %s', (origin) => {
    expect(
      trustedMutationOrigin(new Headers(origin ? { origin } : {}), 'https://admin.example.test'),
    ).toBe(false);
  });
  it('requires an exact configured origin and rejects contradictory browser context', () => {
    expect(
      trustedMutationOrigin(
        new Headers({ origin: 'https://admin.example.test' }),
        'https://admin.example.test',
      ),
    ).toBe(true);
    expect(
      trustedMutationOrigin(
        new Headers({ origin: 'https://admin.example.test', 'sec-fetch-site': 'cross-site' }),
        'https://admin.example.test',
      ),
    ).toBe(false);
  });
  it('accepts signed, current, idempotent catalog invalidation and rejects tampering/expiry', () => {
    const secret = 's'.repeat(32),
      id = '40000000-0000-4000-8000-000000000001';
    const now = Date.now();
    const raw = JSON.stringify({
      id,
      product_id: id,
      type: 'catalog.unpublish',
      revision: 3,
      timestamp: Math.floor(now / 1000),
    });
    const headers = new Headers({
      'idempotency-key': id,
      'x-catalog-signature': createHmac('sha256', secret).update(raw).digest('hex'),
    });
    expect(verifyCatalogEvent(raw, headers, secret, now)).toBe(true);
    expect(verifyCatalogEvent(raw, headers, secret, now)).toBe(true);
    expect(verifyCatalogEvent(raw.replace('unpublish', 'publish'), headers, secret, now)).toBe(
      false,
    );
    expect(verifyCatalogEvent(raw, headers, secret, now + 301_000)).toBe(false);
    expect(verifyCatalogEvent(raw, headers, 'short', now)).toBe(false);
  });
  it('rejects inverted or malformed typed filters rather than broadening the catalog', () => {
    const id = '40000000-0000-4000-8000-000000000001';
    expect(() =>
      technicalFilters(
        new URLSearchParams({ [`spec.${id}.min`]: '100', [`spec.${id}.max`]: '70' }),
      ),
    ).toThrow();
    expect(() =>
      technicalFilters(new URLSearchParams({ [`spec.${id}.option`]: 'invalid' })),
    ).toThrow();
    expect(technicalFilters(new URLSearchParams({ [`spec.${id}.boolean`]: 'false' }))).toEqual([
      { attribute: id, boolean: false },
    ]);
  });
});

describe('production refinement: private PDF delivery without public storage paths', () => {
  const id = '40000000-0000-4000-8000-000000000001';
  const request = () => new Request(`https://example.test/functions/v1/catalog-document?id=${id}`);
  const delivery = () => ({
    visible: vi.fn(async () => true),
    source: vi.fn(async () => ({ bucket: 'catalog-documents', path: 'private/source.pdf' })),
    download: vi.fn(async () => new Blob(['%PDF-1.7\nSynthetic test document'])),
  });
  it('returns only verified bytes with attachment/no-store headers', async () => {
    const result = await serveCatalogDocument(request(), delivery());
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toContain('no-store');
    expect(result.headers.get('content-disposition')).toContain('attachment;');
    expect(await result.text()).toContain('%PDF-');
    expect([...result.headers].join(' ')).not.toContain('private/source');
  });
  it('never reads a private source for an unpublished document', async () => {
    const services = delivery();
    services.visible.mockResolvedValue(false);
    expect((await serveCatalogDocument(request(), services)).status).toBe(404);
    expect(services.source).not.toHaveBeenCalled();
    expect(services.download).not.toHaveBeenCalled();
  });
  it('fails closed if publication is withdrawn while downloading', async () => {
    const services = delivery();
    services.visible.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect((await serveCatalogDocument(request(), services)).status).toBe(404);
  });
  it('rejects malformed bytes and all mutation methods', async () => {
    const services = delivery();
    services.download.mockResolvedValue(new Blob(['invalid']));
    expect((await serveCatalogDocument(request(), services)).status).toBe(503);
    expect(
      (await serveCatalogDocument(new Request(request(), { method: 'POST' }), services)).status,
    ).toBe(405);
  });
});
