import { describe, it, expect } from 'vitest';
import sharp from '../apps/admin/node_modules/sharp';
import { verifyImageBytes } from '../apps/admin/src/lib/verify-image';
describe('actual R2 image decoding and generated sizes', () => {
  const base =
    'catalog/20000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000003';
  const generate = (width = 1200, height = 600) =>
    sharp({ create: { width, height, channels: 3, background: '#486ab8' } })
      .png()
      .toBuffer();
  it('fully decodes and generates three metadata-stripped immutable WebP outputs', async () => {
    const bytes = await generate();
    const result = await verifyImageBytes(
      bytes,
      'image/png',
      bytes.length,
      base,
      'https://images.example.com',
    );
    expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.outputs.map((o) => o.entry.width)).toEqual([320, 768, 1200]);
    for (const output of result.outputs) {
      const meta = await sharp(output.bytes).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.exif).toBeUndefined();
      expect(output.entry.url).toBe('https://images.example.com/' + output.entry.key);
    }
  });
  it('rejects MIME, magic and byte count mismatches', async () => {
    const bytes = await generate();
    await expect(
      verifyImageBytes(bytes, 'image/jpeg', bytes.length, base, 'https://images.example.com'),
    ).rejects.toThrow('declaration');
    await expect(
      verifyImageBytes(bytes, 'image/png', bytes.length - 1, base, 'https://images.example.com'),
    ).rejects.toThrow('declaration');
    await expect(
      verifyImageBytes(
        new TextEncoder().encode('<svg/>'),
        'image/png',
        6,
        base,
        'https://images.example.com',
      ),
    ).rejects.toThrow();
  });
  it('rejects tiny images and corrupt files even with a PNG signature', async () => {
    const bytes = await generate(50, 50);
    await expect(
      verifyImageBytes(bytes, 'image/png', bytes.length, base, 'https://images.example.com'),
    ).rejects.toThrow('100');
    const good = await generate();
    const corrupt = good.subarray(0, 48);
    await expect(
      verifyImageBytes(corrupt, 'image/png', corrupt.length, base, 'https://images.example.com'),
    ).rejects.toThrow();
  });
});
