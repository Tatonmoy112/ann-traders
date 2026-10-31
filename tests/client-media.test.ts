import { describe, expect, it } from 'vitest';
import { publicImageUrl } from '../apps/client/src/lib/catalog-media';
describe('public image origin boundary', () => {
  it('accepts known legacy assets and configured CDN paths', () => {
    expect(publicImageUrl('https://imagedelivery.net/account/id/card')).toContain(
      'imagedelivery.net',
    );
    expect(
      publicImageUrl(
        'https://images.example.test/catalog/card.webp',
        'https://images.example.test/catalog',
      ),
    ).toContain('card.webp');
  });
  it.each([
    'javascript:alert(1)',
    'data:image/svg+xml,evil',
    'http://127.0.0.1/private',
    'https://unknown.example/card.webp',
    'https://images.example.test.evil/card.webp',
    'https://user:password@images.example.test/card.webp',
    'https://images.example.test/card.webp?signature=private',
  ])('rejects unsupported media: %s', (url) => {
    expect(publicImageUrl(url, 'https://images.example.test')).toBeNull();
  });
  it('enforces configured path prefixes without treating a similar prefix as a match', () => {
    expect(
      publicImageUrl(
        'https://images.example.test/catalogue/card.webp',
        'https://images.example.test/catalog',
      ),
    ).toBeNull();
  });
});
