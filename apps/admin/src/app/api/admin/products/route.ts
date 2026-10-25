import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { body, databaseError, failure, json } from '@/lib/http';
export async function GET(request: Request) {
  try {
    const { db } = await requireAdmin();
    const q = new URL(request.url).searchParams;
    const args = {
      search: q.get('q') ?? '',
      state: q.get('status') ?? '',
      category: q.get('category') || undefined,
      brand: q.get('brand') || undefined,
      page: Number(q.get('page') ?? 1),
      page_size: 20,
      sort: q.get('sort') ?? 'updated_at',
      ascending: q.get('asc') === 'true',
    };
    const { data, error } = await db.rpc('list_admin_products', args);
    if (error) databaseError(error);
    return json(data);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const { db } = await requireAdmin();
    const input = z
      .object({
        name: z.string().trim().min(2).max(255),
        product_code: z.string().trim().min(2).max(80),
        slug: z
          .string()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
          .max(280),
      })
      .parse(await body(request));
    const { data, error } = await db.rpc('create_product_draft', {
      p_name: input.name,
      p_code: input.product_code,
      p_slug: input.slug,
    });
    if (error) databaseError(error);
    return json({ id: data }, 201);
  } catch (e) {
    return failure(e);
  }
}
