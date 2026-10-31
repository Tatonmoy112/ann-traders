import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get, ApiError } from '../apps/client/src/lib/http';
describe('browser catalog HTTP transport', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'https://catalog.example.test' } });
  });
  afterEach(() => vi.unstubAllGlobals());
  it.each([
    'https://evil.example/test',
    '//evil.example/api/catalog/products',
    '/api/catalog/../../admin',
    '/api/catalog/\\evil',
    '/api/catalog/products#fragment',
  ])('rejects external or escaped paths: %s', async (path) => {
    const mock = vi.fn();
    vi.stubGlobal('fetch', mock);
    await expect(get(path)).rejects.toBeInstanceOf(ApiError);
    expect(mock).not.toHaveBeenCalled();
  });
  it('sends same-origin GETs with a timeout, no-store and no redirects', async () => {
    const mock = vi.fn(
      async () => new Response('[]', { headers: { 'content-type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', mock);
    await expect(get('/api/catalog/brands')).resolves.toEqual([]);
    const [url, init] = mock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.origin).toBe('https://catalog.example.test');
    expect(init).toMatchObject({
      method: 'GET',
      cache: 'no-store',
      redirect: 'error',
      credentials: 'same-origin',
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
  it('keeps infrastructure error bodies private and preserves rate-limit status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('private database diagnostics', { status: 429 })),
    );
    try {
      await get('/api/catalog/products');
      expect.fail('must reject');
    } catch (error) {
      expect(error).toMatchObject({ status: 429 });
      expect((error as Error).message).not.toContain('private');
    }
  });
});
