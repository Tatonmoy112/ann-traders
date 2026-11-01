import { requireAdmin, HttpError } from '@/lib/auth';
import { boundedBody, requireMutationOrigin, failure, json } from '@/lib/http';
import { r2Store } from '@/lib/r2';
import sharp from 'sharp';

export async function POST(request: Request) {
  try {
    await requireAdmin(['super_admin', 'admin']);
    requireMutationOrigin(request);
    const formData = await new Response(await boundedBody(request, 5300000), {
      headers: { 'Content-Type': request.headers.get('content-type') || '' },
    }).formData();
    const file = formData.get('file');
    const table = formData.get('table');

    if (!file || !(file instanceof File)) {
      throw new HttpError(400, 'Please select an image file to upload.');
    }

    if (!table || typeof table !== 'string' || !['brands', 'categories'].includes(table)) {
      throw new HttpError(400, 'Invalid master table specified.');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new HttpError(400, 'Image file size must be less than 5 MB.');
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new HttpError(400, 'Supported image formats are JPEG, PNG, and WebP.');
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const store = r2Store();
    const assetId = crypto.randomUUID();

    let outputBytes: Buffer;
    const contentType = 'image/webp';
    const extension = 'webp';
    try {
      const isBrand = table === 'brands';
      const maxDimension = isBrand ? 512 : 1200;

      const image = sharp(bytes, {
        limitInputPixels: 40000000,
        failOn: 'warning',
        animated: false,
      });
      const metadata = await image.metadata();
      if (
        !metadata.width ||
        !metadata.height ||
        !['jpeg', 'png', 'webp'].includes(metadata.format || '') ||
        metadata.width > 12000 ||
        metadata.height > 12000 ||
        (metadata.pages || 1) > 1
      )
        throw new Error('Invalid image');
      outputBytes = await image
        .rotate()
        .resize({
          width: maxDimension,
          height: maxDimension,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new HttpError(
        422,
        'Choose a valid, single-frame JPEG, PNG, or WebP image up to 12,000 pixels and 40 megapixels.',
      );
    }

    const key = `masters/${table}/${assetId}.${extension}`;

    try {
      await store.putMasterImage(key, outputBytes, contentType);
    } finally {
      store.client.destroy();
    }

    const publicUrl = `${store.config.publicOrigin}/${key}`;
    return json({ url: publicUrl });
  } catch (e) {
    return failure(e);
  }
}
