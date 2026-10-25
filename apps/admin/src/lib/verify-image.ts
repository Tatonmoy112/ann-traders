import sharp from 'sharp';
import { createHash } from 'node:crypto';
import type { ManifestEntry } from '@ann/storage';
import { imageMime } from './provider';
export async function verifyImageBytes(
  bytes: Uint8Array,
  declaredMime: string,
  declaredSize: number,
  baseKey: string,
  origin: string,
) {
  if (bytes.length !== declaredSize || bytes.length > 10485760 || imageMime(bytes) !== declaredMime)
    throw new Error('Image content does not match the upload declaration');
  const pipeline = () =>
    sharp(bytes, { limitInputPixels: 144000000, failOn: 'warning', animated: false })
      .rotate()
      .timeout({ seconds: 15 });
  const metadata = await pipeline().metadata();
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width < 100 ||
    metadata.height < 100 ||
    metadata.width > 12000 ||
    metadata.height > 12000 ||
    (metadata.pages ?? 1) > 1
  )
    throw new Error('Use a still image between 100 and 12,000 pixels');
  const outputs: { entry: ManifestEntry; bytes: Uint8Array }[] = [];
  for (const [kind, size] of [
    ['thumbnail', 320],
    ['card', 768],
    ['detail', 2000],
  ] as const) {
    const output = await pipeline()
      .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    const key = `${baseKey}/${kind}.webp`;
    outputs.push({
      bytes: output.data,
      entry: {
        kind,
        key,
        url: `${origin}/${key}`,
        width: output.info.width,
        height: output.info.height,
        bytes: output.data.length,
        sha256: createHash('sha256').update(output.data).digest('hex'),
      },
    });
  }
  return {
    width: metadata.width,
    height: metadata.height,
    digest: createHash('sha256').update(bytes).digest('hex'),
    outputs,
  };
}
