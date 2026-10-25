import { describe, it, expect } from 'vitest';
import {
  canPublish,
  canManageAdmins,
  convertWithinFamily,
  formatPrice,
  slugify,
} from '../packages/domain/src';
import { priceInput, saveDraftInput } from '../packages/validation/src';
describe('domain boundaries', () => {
  it('normalizes public slugs', () =>
    expect(slugify('White Marker Paper / 70 GSM')).toBe('white-marker-paper-70-gsm'));
  it('converts mass using decimal arithmetic', () =>
    expect(
      convertWithinFamily(
        '1250',
        { family: 'mass', factor: '0.001' },
        { family: 'mass', factor: '1' },
      ),
    ).toBe('1.2500'));
  it('rejects dimensional and GSM quantity conversions', () => {
    expect(() =>
      convertWithinFamily('1', { family: 'mass', factor: '1' }, { family: 'length', factor: '1' }),
    ).toThrow();
    expect(() =>
      convertWithinFamily(
        '65',
        { family: 'areal_density', factor: '1' },
        { family: 'areal_density', factor: '1' },
      ),
    ).toThrow();
  });
  it('separates publishing and admin management permissions', () => {
    expect(canPublish('editor')).toBe(false);
    expect(canPublish('admin')).toBe(true);
    expect(canManageAdmins('admin')).toBe(false);
  });
  it('formats on-request without exposing numeric values', () =>
    expect(formatPrice('on_request', '100', '200', 'BDT', 'kg')).toBe('Price on request'));
});
const id = '10000000-0000-4000-8000-000000000001';
const price = {
  id,
  variant_id: id,
  currency_code: 'BDT',
  price_type: 'fixed',
  min_price: '85.0000',
  max_price: null,
  price_unit_id: id,
  trade_term: '',
  valid_from: '2026-10-24T00:00:00.000Z',
  valid_until: null,
  is_active: true,
};
describe('price and aggregate validation', () => {
  it('accepts precise decimal price strings', () =>
    expect(priceInput.safeParse(price).success).toBe(true));
  it('rejects JS numeric prices and negative values', () => {
    expect(priceInput.safeParse({ ...price, min_price: 85 }).success).toBe(false);
    expect(priceInput.safeParse({ ...price, min_price: '-1' }).success).toBe(false);
  });
  it('rejects inverted ranges and intervals', () => {
    expect(priceInput.safeParse({ ...price, price_type: 'range', max_price: '2' }).success).toBe(
      false,
    );
    expect(
      priceInput.safeParse({ ...price, valid_until: '2025-01-01T00:00:00.000Z' }).success,
    ).toBe(false);
  });
  it('rejects amounts on an on-request quote', () =>
    expect(priceInput.safeParse({ ...price, price_type: 'on_request' }).success).toBe(false));
  it('rejects a price attached to a foreign variant', () =>
    expect(
      saveDraftInput.safeParse({
        id,
        revision: 1,
        product: {
          name: 'Paper',
          product_code: 'PAPER',
          slug: 'paper',
          primary_category_id: null,
          brand_id: null,
          short_description: null,
          description: null,
          country_of_origin: null,
          seo_title: null,
          seo_description: null,
        },
        variants: [],
        prices: [price],
      }).success,
    ).toBe(false));
});
