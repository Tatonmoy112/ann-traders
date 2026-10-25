import { z } from 'zod';
import { relations, type Database, type Json } from '@ann/database';
import { requireAdmin, HttpError } from '@/lib/auth';
import { body, databaseError, failure, json } from '@/lib/http';
type Context = { params: Promise<{ id: string; table: string }> };
export async function GET(_request: Request, { params }: Context) {
  try {
    const { db } = await requireAdmin();
    const { id, table } = await params;
    z.uuid().parse(id);
    if (!Object.hasOwn(relations, table)) throw new HttpError(404, 'Unknown relationship');
    let owner = 'product_id',
      ids = [id];
    if (table.startsWith('variant_') || table === 'price_tiers') {
      const { data, error } = await db
        .from('product_variants')
        .select('id')
        .eq('product_id', id)
        .limit(101);
      if (error) databaseError(error);
      ids = data?.map((v) => v.id) ?? [];
      owner = 'variant_id';
      if (table === 'price_tiers') {
        const { data: prices, error: pe } = await db
          .from('variant_prices')
          .select('id')
          .in('variant_id', ids)
          .limit(501);
        if (pe) databaseError(pe);
        ids = prices?.map((p) => p.id) ?? [];
        owner = 'variant_price_id';
      }
    }
    if (!ids.length) return json([]);
    const selections: Record<string, string> = {
      product_attribute_values:
        'id,product_id,attribute_id,option_id,value_text,value_number::text,value_boolean,unit_id',
      variant_attribute_values:
        'id,variant_id,attribute_id,option_id,value_text,value_number::text,value_boolean,unit_id',
      variant_packaging:
        'id,variant_id,packaging_type,pack_quantity::text,pack_unit_id,package_description,is_default',
      variant_fiber_composition: 'variant_id,fiber_id,percentage::text',
      price_tiers:
        'id,variant_price_id,min_quantity::text,max_quantity::text,quantity_unit_id,unit_price::text,sort_order',
    };
    const { data, error } = await db
      .from(table as keyof Database['public']['Tables'])
      .select(selections[table] ?? '*')
      .in(owner, ids)
      .limit(501);
    if (error) databaseError(error);
    if ((data?.length ?? 0) > 500) throw new HttpError(422, 'Relationship exceeds editor limit');
    return json(data);
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(request: Request, { params }: Context) {
  try {
    const { db } = await requireAdmin();
    const { id, table } = await params;
    z.uuid().parse(id);
    if (!Object.hasOwn(relations, table)) throw new HttpError(404, 'Unknown relationship');
    const config = relations[table],
      shape: Record<string, z.ZodType> = {};
    for (const f of config.fields) {
      let field: z.ZodType = f.lookup
        ? z.uuid()
        : f.type === 'boolean'
          ? z.boolean()
          : f.type === 'number'
            ? z.number().int()
            : z.string().max(2000);
      if (f.key === 'value_boolean') field = z.union([z.boolean(), z.enum(['true', 'false'])]);
      if (!f.required) field = field.nullable().optional();
      shape[f.key] = field;
    }
    const row = z.object({ ...shape, id: z.uuid().optional(), product_id: z.uuid().optional() });
    const input = z
      .object({ revision: z.number().int().positive(), rows: z.array(row).max(500) })
      .parse(await body(request));
    const clean = input.rows.map((r) => {
      const v: Record<string, unknown> = { ...r };
      if (v.value_boolean === 'true') v.value_boolean = true;
      if (v.value_boolean === 'false') v.value_boolean = false;
      return v;
    });
    const { data, error } = await db.rpc('save_product_relation', {
      product: id,
      expected_revision: input.revision,
      relation: table,
      rows: clean as Json,
    });
    if (error) databaseError(error);
    return json({ revision: data });
  } catch (e) {
    return failure(e);
  }
}
