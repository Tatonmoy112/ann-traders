import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { body, failure, json } from '@/lib/http';

const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['publish', 'unpublish', 'archive', 'delete', 'restore']),
});

export async function POST(request: Request) {
  try {
    const { db } = await requireAdmin(['super_admin', 'admin']);
    const input = bulkSchema.parse(await body(request));

    const { data: products, error: fetchErr } = await db
      .from('products')
      .select('id, name, revision, status, deleted_at')
      .in('id', input.ids);

    if (fetchErr) throw fetchErr;

    const succeeded: { id: string; name: string }[] = [];
    const failed: { id: string; name: string; reason: string }[] = [];
    const productMap = new Map((products ?? []).map((p) => [p.id, p]));

    for (const id of input.ids) {
      const prod = productMap.get(id);
      if (!prod) {
        failed.push({ id, name: id, reason: 'Product not found' });
        continue;
      }

      try {
        const { error: rpcErr } = await db.rpc('product_lifecycle', {
          product: id,
          expected_revision: prod.revision,
          operation: input.action,
        });

        if (rpcErr) {
          failed.push({
            id,
            name: prod.name,
            reason: rpcErr.message || 'Failed lifecycle transition',
          });
        } else {
          succeeded.push({ id, name: prod.name });
        }
      } catch (err) {
        failed.push({
          id,
          name: prod.name,
          reason: (err as Error).message,
        });
      }
    }

    return json({
      action: input.action,
      total: input.ids.length,
      succeededCount: succeeded.length,
      failedCount: failed.length,
      succeeded,
      failed,
    });
  } catch (e) {
    return failure(e);
  }
}

