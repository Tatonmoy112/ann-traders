import { z } from 'zod';
import { requireAdmin, HttpError } from '@/lib/auth';
import { requireMutationOrigin, databaseError, failure, json } from '@/lib/http';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db } = await requireAdmin();
    requireMutationOrigin(request);
    const { id } = await params;
    z.uuid().parse(id);
    const { data: source, error: readError } = await db
      .from('products')
      .select('revision')
      .eq('id', id)
      .single();
    if (readError || !source) throw new HttpError(404, 'Source product not found');
    const { data, error } = await db.rpc('duplicate_catalog_product', {
      product: id,
      expected_revision: source.revision,
    });
    if (error) databaseError(error);
    return json({ id: data }, 201);
  } catch (error) {
    return failure(error);
  }
}
