import { requireAdmin, HttpError } from '@/lib/auth';
import { failure, json } from '@/lib/http';
import { r2Store } from '@/lib/r2';
import sharp from 'sharp';

export async function POST(request: Request) {
  try {
    await requireAdmin(['super_admin', 'admin']);
    const formData = await request.formData();
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

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      throw new HttpError(400, 'Supported image formats are JPEG, PNG, WebP, and SVG.');
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const store = r2Store();
    const assetId = crypto.randomUUID();

    let outputBytes: Buffer;
    let contentType = 'image/webp';
    let extension = 'webp';

    if (file.type === 'image/svg+xml') {
      outputBytes = bytes;
      contentType = 'image/svg+xml';
      extension = 'svg';
    } else {
      const isBrand = table === 'brands';
      const maxDimension = isBrand ? 512 : 1200;

      outputBytes = await sharp(bytes)
        .rotate()
        .resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    }

    const key = `masters/${table}/${assetId}.${extension}`;

    await store.putMasterImage(key, outputBytes, contentType);

    const publicUrl = `${store.config.publicOrigin}/${key}`;
    return json({ url: publicUrl });
  } catch (e) {
    return failure(e);
  }
}
