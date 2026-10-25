import { z } from 'zod';
import { requireAdmin, HttpError } from '@/lib/auth';
import { databaseError, failure, json } from '@/lib/http';
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

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile, db } = await requireAdmin(['super_admin', 'admin']);
    const { id } = await params;
    z.uuid().parse(id);

    const { data: doc, error: findError } = await db
      .from('product_documents')
      .select('id, product_id, storage_path, bucket_id, title')
      .eq('id', id)
      .single();

    if (findError || !doc) throw new HttpError(404, 'Document not found');

    const privileged = integrationClient();

    // 1. Remove binary from storage bucket
    if (doc.storage_path) {
      await privileged.storage.from(doc.bucket_id).remove([doc.storage_path]);
    }

    // 2. Remove row from product_documents table
    const { error: deleteError } = await privileged
      .from('product_documents')
      .delete()
      .eq('id', id);

    if (deleteError) databaseError(deleteError);

    // 3. Increment parent product revision
    const { data: prod } = await db
      .from('products')
      .select('revision')
      .eq('id', doc.product_id)
      .single();

    if (prod) {
      await privileged
        .from('products')
        .update({
          revision: (prod.revision ?? 0) + 1,
          updated_by: profile.id,
        })
        .eq('id', doc.product_id);
    }

    return json({ success: true, id, productId: doc.product_id });
  } catch (e) {
    return failure(e);
  }
}
