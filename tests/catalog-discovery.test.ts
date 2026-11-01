import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readCatalogCards, readCatalogFacets } from '../apps/client/src/lib/catalog-discovery';
import { parseCatalogFilters, InvalidCatalogFilter } from '../apps/client/src/lib/catalog-contract';

describe('published catalog API compatibility', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'test-public-key');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  const reply = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  const filters = () =>
    parseCatalogFilters(new URLSearchParams('page=2&category=fabric&sort=name_asc'));
  it('uses the new read model when installed', async () => {
    const data = { rows: [{ id: 'published' }], next_cursor: { id: 'cursor' } };
    const mock = vi.fn(async () => reply(data));
    vi.stubGlobal('fetch', mock);
    expect(await readCatalogCards(filters())).toEqual(data);
    expect(mock).toHaveBeenCalledTimes(1);
    const [input] = mock.mock.calls[0] as unknown as [string];
    expect(new URL(input).pathname).toBe('/rest/v1/rpc/browse_product_cards');
  });
  it('uses only the original published listing GET when the new RPC is absent', async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(reply({ code: 'PGRST202' }, 404))
      .mockResolvedValueOnce(reply([{ id: 'published' }]));
    vi.stubGlobal('fetch', mock);
    expect(await readCatalogCards(filters())).toEqual({
      rows: [{ id: 'published' }],
      next_cursor: null,
    });
    expect(mock).toHaveBeenCalledTimes(2);
    const [input, init] = mock.mock.calls[1];
    const url = new URL(input);
    expect(url.pathname).toBe('/rest/v1/rpc/list_product_cards');
    expect(url.searchParams.get('page_number')).toBe('2');
    expect(url.searchParams.get('category_filter')).toBe('fabric');
    expect(url.searchParams.has('attribute_filters')).toBe(false);
    expect(url.searchParams.has('after_cursor')).toBe(false);
    expect(init.method).toBe('GET');
    expect(new Headers(init.headers).get('accept-profile')).toBe('public_catalog');
  });
  it.each([
    ['42501', 403],
    ['PGRST205', 404],
    ['XX000', 503],
  ])('never falls back for %s failures', async (code, status) => {
    const mock = vi.fn(async () => reply({ code }, status as number));
    vi.stubGlobal('fetch', mock);
    await expect(readCatalogCards(filters())).rejects.toThrow('unavailable');
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it('never silently drops technical filters on an older database', async () => {
    const mock = vi.fn(async () => reply({ code: 'PGRST202' }, 404));
    vi.stubGlobal('fetch', mock);
    const input = filters();
    input.attributes = [{ attribute: '40000000-0000-4000-8000-000000000001', min: '70' }];
    await expect(readCatalogCards(input)).rejects.toBeInstanceOf(InvalidCatalogFilter);
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it('rejects incompatible saved cursors instead of showing the wrong page', async () => {
    const mock = vi.fn(async () => reply({ code: 'PGRST202' }, 404));
    vi.stubGlobal('fetch', mock);
    await expect(readCatalogCards(filters(), { id: 'saved' })).rejects.toBeInstanceOf(
      InvalidCatalogFilter,
    );
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it('keeps basic filters available when technical facet configuration is not installed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => reply({ code: 'PGRST202' }, 404)),
    );
    expect(await readCatalogFacets('fabric')).toEqual([]);
  });
  it('does not hide facet permission or availability failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => reply({ code: '42501' }, 403)),
    );
    await expect(readCatalogFacets('fabric')).rejects.toThrow('unavailable');
  });
  it('keeps errors from the installed legacy API visible instead of returning an empty catalog', async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(reply({ code: 'PGRST202' }, 404))
      .mockResolvedValueOnce(reply({ code: '42501' }, 403));
    vi.stubGlobal('fetch', mock);
    await expect(readCatalogCards(filters())).rejects.toThrow('unavailable');
  });
});
