import { z } from 'zod';
import { requireAdmin, HttpError } from '@/lib/auth';
import { body, databaseError, failure, json } from '@/lib/http';
import { mediaDelivery } from '@/lib/r2';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db } = await requireAdmin();
    const { id } = await params;
    z.uuid().parse(id);
    const [images, documents] = await Promise.all([
      db
        .from('product_media')
        .select('*')
        .eq('product_id', id)
        .is('retired_at', null)
        .order('sort_order')
        .limit(100),
      db
        .from('product_documents')
        .select('id,title,document_type,is_public,created_at,bytes,file_extension,variant_id')
        .eq('product_id', id)
        .order('sort_order')
        .limit(100),
    ]);
    if (images.error) databaseError(images.error);
    if (documents.error) databaseError(documents.error);
    return json({ images: (images.data ?? []).map(mediaDelivery), documents: documents.data });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db } = await requireAdmin();
    const { id } = await params;
    const input = z
      .object({
        media: z.uuid(),
        revision: z.number().int().positive(),
        operation: z.enum(['primary', 'alt', 'detach', 'order']),
        alt: z.string().max(255).default(''),
      })
      .parse(await body(request));
    z.uuid().parse(id);
    const { data, error } = await db.rpc('product_media_action', {
      product: id,
      expected_revision: input.revision,
      media: input.media,
      operation: input.operation,
      alt: input.alt,
    });
    if (error) databaseError(error);
    if (!data) throw new HttpError(400, 'Image action failed');
    return json({ revision: data });
  } catch (e) {
    return failure(e);
  }
}
