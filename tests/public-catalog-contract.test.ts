import { describe, it, expect } from 'vitest';
import {
  categoryTree,
  parseCatalogFilters,
  priceLabel,
  currentVariantPrices,
} from '../apps/client/src/lib/catalog-contract';
describe('public catalog contracts', () => {
  it.each(['NaN', 'Infinity', '-2', '0', '1.5'])('bounds malformed pagination %s', (value) => {
    const filters = parseCatalogFilters(new URLSearchParams({ page: value, pageSize: value }));
    expect(filters.page).toBe(1);
    expect(filters.pageSize).toBe(12);
  });
  it('caps sizes, preserves exact slugs, and normalizes both sort contracts', () => {
    const filters = parseCatalogFilters(
      new URLSearchParams('pageSize=999&category=unknown&brand=unknown&sort=name_asc'),
    );
    expect(filters.pageSize).toBe(24);
    expect(filters.category).toBe('unknown');
    expect(filters.brand).toBe('unknown');
    expect(filters.sort).toBe('name');
    expect(filters.ascending).toBe(true);
    expect(parseCatalogFilters(new URLSearchParams('sort=name&asc=true')).ascending).toBe(true);
  });
  it('retains Bengali search while removing PostgREST expression characters', () => {
    const bangla = '\u09b8\u09c1\u09a4\u09be';
    const { search } = parseCatalogFilters(
      new URLSearchParams({ q: bangla + ',().name.eq.*_test%' }),
    );
    expect(search).toContain(bangla);
    expect(search).not.toMatch(/[,.()*_%]/);
  });
  it('renders unit-correct fixed, range and on-request labels', () => {
    expect(priceLabel({ type: 'fixed', min: '100', currency: 'BDT', unit: 'kg' })).toBe(
      'BDT 100 / kg',
    );
    expect(
      priceLabel({ type: 'range', min: '85', max: '100', currency: 'USD', unit: 'roll' }),
    ).toBe('USD 85 \u2013 100 / roll');
    expect(priceLabel({ type: 'on_request' })).toBe('Price on request');
    expect(priceLabel({ type: 'fixed', min: '100', currency: 'BDT' })).toBe('Price on request');
    expect(priceLabel({ type: 'fixed', min: 'NaN', currency: 'BDT', unit: 'kg' })).toBe(
      'Price on request',
    );
  });
  it('suppresses expired cached prices including the exact expiry instant', () => {
    expect(
      priceLabel({
        type: 'fixed',
        min: '100',
        currency: 'BDT',
        unit: 'kg',
        valid_until: '2000-01-01T00:00:00Z',
      }),
    ).toBe('Price on request');
    const base = {
      id: 'p',
      currency: 'BDT',
      type: 'fixed',
      min: '100',
      max: null,
      unit: 'kg',
      trade_term: null,
      tiers: [],
    };
    expect(
      currentVariantPrices(
        [{ ...base, valid_until: '2026-10-31T00:00:00Z' }],
        Date.parse('2026-10-31T00:00:00Z'),
      ),
    ).toEqual([]);
  });
  it('builds trees without losing children of inactive parents or allowing cycles', () => {
    const row = (id: string, parent_id: string | null) => ({
      id,
      parent_id,
      slug: id,
      name: id,
      description: null,
      image_path: null,
      sort_order: 0,
    });
    const tree = categoryTree([row('root', null), row('child', 'root'), row('orphan', 'missing')]);
    expect(tree.map((node) => node.id)).toEqual(['root', 'orphan']);
    expect(tree[0].children?.[0].id).toBe('child');
    expect(() => JSON.stringify(categoryTree([row('a', 'b'), row('b', 'a')]))).not.toThrow();
  });
  it('suppresses malformed validity timestamps instead of displaying indefinite prices', () => {
    expect(
      priceLabel({
        type: 'fixed',
        min: '100',
        currency: 'BDT',
        unit: 'kg',
        valid_until: 'invalid',
      }),
    ).toBe('Price on request');
  });
});
