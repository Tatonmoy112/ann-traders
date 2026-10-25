import { z } from 'zod';
import { requireAdmin, HttpError } from '@/lib/auth';
import { body, databaseError, failure, json } from '@/lib/http';
import { lifecycleInput, saveDraftInput } from '@ann/validation';
import type { Json } from '@ann/database';
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const { db } = await requireAdmin();
    const { id } = await context.params;
    z.uuid().parse(id);
    const [{ data: product, error }, { data: variants, error: ve }] = await Promise.all([
      db.from('products').select('*').eq('id', id).single(),
      db
        .from('product_variants')
        .select(
          'id,product_id,sku,variant_name,model_number,base_unit_id,minimum_order_qty::text,minimum_order_unit_id,monthly_supply_capacity::text,capacity_unit_id,lead_time_days,availability_status,is_default,is_active,sort_order',
        )
        .eq('product_id', id)
        .order('sort_order')
        .limit(101),
    ]);
    if (error || !product) throw new HttpError(404, 'Product not found');
    if (ve) databaseError(ve);
    if ((variants?.length ?? 0) > 100)
      throw new HttpError(422, 'This editor supports up to 100 variants per product.');
    const ids = variants?.map((v) => v.id) ?? [];
    const { data: prices, error: pe } = ids.length
      ? await db
          .from('variant_prices')
          .select(
            'id,variant_id,currency_code,price_type,min_price::text,max_price::text,price_unit_id,trade_term,valid_from,valid_until,is_active',
          )
          .in('variant_id', ids)
          .limit(501)
      : { data: [], error: null };
    if (pe) databaseError(pe);
    if ((prices?.length ?? 0) > 500)
      throw new HttpError(422, 'Price history exceeds editor limit.');
    return json({
      product,
      variants: variants?.map((v) => ({
        ...v,
        minimum_order_qty: v.minimum_order_qty === null ? null : String(v.minimum_order_qty),
        monthly_supply_capacity:
          v.monthly_supply_capacity === null ? null : String(v.monthly_supply_capacity),
      })),
      prices: prices?.map((p) => ({
        ...p,
        min_price: p.min_price === null ? null : String(p.min_price),
        max_price: p.max_price === null ? null : String(p.max_price),
        valid_from: new Date(p.valid_from).toISOString(),
        valid_until: p.valid_until ? new Date(p.valid_until).toISOString() : null,
      })),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(request: Request, context: Context) {
  try {
    const { db } = await requireAdmin();
    const { id } = await context.params;
    const input = saveDraftInput.parse(await body(request));
    if (input.id !== id) throw new HttpError(422, 'Product mismatch');
    const { data, error } = await db.rpc('save_product_draft', {
      payload: input as unknown as Json,
    });
    if (error) databaseError(error);
    return json({ revision: data });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const { db } = await requireAdmin(['super_admin', 'admin']);
    const { id } = await context.params;
    const input = lifecycleInput.parse(await body(request));
    if (input.id !== id) throw new HttpError(422, 'Product mismatch');
    const { data, error } = await db.rpc('product_lifecycle', {
      product: id,
      expected_revision: input.revision,
      operation: input.action,
    });
    if (error) databaseError(error);
    return json({ revision: data });
  } catch (e) {
    return failure(e);
  }
}
