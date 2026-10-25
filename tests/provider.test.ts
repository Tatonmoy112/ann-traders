import { describe, it, expect } from 'vitest';
import { validatePdf, imageMime } from '../apps/admin/src/lib/provider';
describe('provider verification boundary', () => {
  it('checks PDF signature as well as metadata', () => {
    expect(() => validatePdf(new TextEncoder().encode('%PDF-1.7\ntest'))).not.toThrow();
    expect(() => validatePdf(new TextEncoder().encode('<svg>payload</svg>'))).toThrow();
  });
  it('rejects oversized documents', () =>
    expect(() => validatePdf(new Uint8Array(10485761))).toThrow());
  it('rejects SVG or HTML masquerading as a product image', () => {
    expect(() => imageMime(new TextEncoder().encode('<svg/>'))).toThrow();
    expect(imageMime(new Uint8Array([255, 216, 255, 0]))).toBe('image/jpeg');
  });
});
