import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { databaseError, failure, json } from '@/lib/http';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db } = await requireAdmin();
    const { id } = await params;
    z.uuid().parse(id);
    const { data, error } = await db.rpc('product_publish_errors', { product: id });
    if (error) databaseError(error);
    return json(data);
  } catch (e) {
    return failure(e);
  }
}
