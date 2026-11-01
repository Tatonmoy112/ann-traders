import { z } from 'zod';
import { masters } from '@ann/database';
import { requireAdmin, HttpError } from '@/lib/auth';
import { body, databaseError, failure, json } from '@/lib/http';
type Context = { params: Promise<{ table: string }> };
type MasterTable =
  | 'categories'
  | 'brands'
  | 'units'
  | 'attribute_definitions'
  | 'attribute_options'
  | 'category_attributes'
  | 'industries'
  | 'applications'
  | 'certifications'
  | 'fibers'
  | 'equipment_models';
function getTable(table: string) {
  if (!Object.hasOwn(masters, table)) throw new HttpError(404, 'Unknown dictionary');
  return table as MasterTable;
}
export async function GET(request: Request, { params }: Context) {
  try {
    const { db } = await requireAdmin();
    const { table } = await params;
    const t = getTable(table),
      q = new URL(request.url).searchParams;
    const page = Math.max(1, Math.min(10000, Math.floor(Number(q.get('page') ?? 1) || 1))),
      limit = q.get('lookup') === 'true' ? 500 : 20;
    let query = db.from(t).select('*', { count: 'exact' });
    const search = (q.get('q') || '')
      .slice(0, 100)
      .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, ' ')
      .trim();
    if (search) {
      const fields = masters[t].fields.filter((f) =>
        [
          'name',
          'code',
          'symbol',
          'slug',
          'value',
          'label',
          'model_name',
          'equipment_type',
        ].includes(f.key),
      );
      if (fields.length)
        query = query.or(fields.map((f) => `${f.key}.ilike.%${search}%`).join(','));
    }
    if (t === 'category_attributes' && q.get('category')) {
      const category = z.uuid().parse(q.get('category'));
      if (q.get('effective') === 'true') {
        const { data, error } = await db.rpc('get_category_attribute_rules', { category });
        if (error) databaseError(error);
        return json({ rows: data, total: Array.isArray(data) ? data.length : 0 });
      }
      query = query.match({ category_id: category });
    }
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (error) databaseError(error);
    const selected = q.get('selected');
    const rows = [...(data || [])];
    if (
      t !== 'category_attributes' &&
      selected &&
      !rows.some((row) => 'id' in row && row.id === selected)
    ) {
      z.uuid().parse(selected);
      const { data: current, error: selectedError } = await db
        .from(t)
        .select('*')
        .eq('id', selected)
        .maybeSingle();
      if (selectedError) databaseError(selectedError);
      if (current) rows.push(current);
    }
    return json({ rows, total: count });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request, { params }: Context) {
  try {
    const { db } = await requireAdmin(['super_admin', 'admin']);
    const { table } = await params;
    const t = getTable(table),
      config = masters[table];
    const shape: Record<string, z.ZodType> = {};
    for (const f of config.fields) {
      let v: z.ZodType =
        f.type === 'boolean'
          ? z.boolean()
          : f.type === 'number'
            ? z.number().int().min(0)
            : f.lookup
              ? z.uuid()
              : f.options
                ? z.enum(f.options as [string, ...string[]])
                : z
                    .string()
                    .trim()
                    .max(f.type === 'textarea' || f.type === 'image' ? 10000 : 280);
      if (f.required && !f.lookup && !f.options) v = z.string().trim().min(1).max(280);
      shape[f.key] = f.required ? v : v.nullable().optional();
    }
    const input = z
      .object({ id: z.uuid().optional(), values: z.object(shape) })
      .parse(await body(request));
    // Dynamic table boundary: field keys and values were validated against the server-owned allowlist.
    const values = input.values as never;
    if (t === 'category_attributes') {
      const { error } = await db
        .from(t)
        .upsert(values, { onConflict: 'category_id,attribute_id,applies_to' });
      if (error) databaseError(error);
      return json({ ok: true });
    }
    const query = input.id
      ? db.from(t).update(values).eq('id', input.id)
      : db.from(t).insert(values);
    const { error } = await query;
    if (error) databaseError(error);
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
