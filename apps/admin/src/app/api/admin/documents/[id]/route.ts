import { z } from 'zod';
import { requireAdmin, HttpError } from '@/lib/auth';
import { body, databaseError, failure, json } from '@/lib/http';
import { integrationClient } from '@/lib/privileged';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db } = await requireAdmin();
    const { id } = await params;
    z.uuid().parse(id);
    const { data: doc } = await db
      .from('product_documents')
      .select('storage_path,bucket_id')
      .eq('id', id)
      .single();
    if (!doc) throw new HttpError(404, 'Document not found');
    const { data, error } = await integrationClient()
      .storage.from(doc.bucket_id)
      .createSignedUrl(doc.storage_path, 60, { download: true });
    if (error) throw new HttpError(502, 'Unable to prepare document download');
    return json({ url: data.signedUrl });
  } catch (e) {
    return failure(e);
  }
}

const actionInput = z.object({
  product: z.uuid(),
  revision: z.number().int().positive(),
  title: z.string().trim().min(1).max(255).optional(),
  visible: z.boolean().optional(),
  variant: z.uuid().nullable().optional(),
});
async function mutate(
  request: Request,
  params: Promise<{ id: string }>,
  operation: 'retire' | 'metadata',
) {
  try {
    const { db } = await requireAdmin();
    const { id } = await params;
    z.uuid().parse(id);
    const input = actionInput.parse(await body(request));
    const { data, error } = await db.rpc('product_document_action', {
      product: input.product,
      expected_revision: input.revision,
      document: id,
      operation,
      title_text: input.title,
      visible: input.visible,
      variant: input.variant ?? undefined,
    });
    if (error) databaseError(error);
    return json({ revision: data });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return mutate(request, params, 'retire');
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return mutate(request, params, 'metadata');
}
