import type { CatalogCategory, CatalogAttributeFilter, DisplayPrice, VariantPrice } from './types';

export class InvalidCatalogFilter extends Error {}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function technicalFilters(params: URLSearchParams): CatalogAttributeFilter[] {
  const filters = new Map<string, CatalogAttributeFilter>();
  for (const [key, value] of params) {
    if (!key.startsWith('spec.') || !value) continue;
    const [, attribute, operator, extra] = key.split('.');
    if (
      !uuidPattern.test(attribute || '') ||
      extra ||
      !['option', 'min', 'max', 'boolean', 'text'].includes(operator)
    )
      throw new InvalidCatalogFilter('Invalid technical filter');
    const filter = filters.get(attribute) || { attribute };
    if (operator === 'option') {
      if (!uuidPattern.test(value)) throw new InvalidCatalogFilter('Invalid option');
      filter.option = value;
    } else if (operator === 'boolean') {
      if (!['true', 'false'].includes(value)) throw new InvalidCatalogFilter('Invalid boolean');
      filter.boolean = value === 'true';
    } else if (operator === 'text') {
      if (value.length > 100) throw new InvalidCatalogFilter('Technical text is too long');
      filter.text = value.trim();
    } else {
      if (!/^-?\d{1,14}(\.\d{1,4})?$/.test(value))
        throw new InvalidCatalogFilter('Invalid specification range');
      filter[operator as 'min' | 'max'] = value;
    }
    if (filters.size >= 8 && !filters.has(attribute))
      throw new InvalidCatalogFilter('Use at most eight technical filters');
    filters.set(attribute, filter);
  }
  const result = [...filters.values()];
  if (
    result.some((f) => f.min !== undefined && f.max !== undefined && Number(f.min) > Number(f.max))
  )
    throw new InvalidCatalogFilter('Minimum must not exceed maximum');
  return result;
}

export type CatalogFilters = ReturnType<typeof parseCatalogFilters>;
const boundedInt = (value: string | null, fallback: number, max: number) => {
  const number = Number(value);
  return value && Number.isSafeInteger(number) && number > 0 ? Math.min(number, max) : fallback;
};
export function parseCatalogFilters(params: URLSearchParams) {
  const sortValue = params.get('sort') || 'updated_at_desc';
  const sort = sortValue.replace(/_(asc|desc)$/, '');
  return {
    category: params.get('category')?.trim().slice(0, 180) || '',
    brand: params.get('brand')?.trim().slice(0, 180) || '',
    search: (params.get('q') || '')
      .slice(0, 80)
      .replace(/[^\p{L}\p{M}\p{N}\s._/+\-]/gu, ' ')
      .trim(),
    featured: params.get('featured') === 'true',
    newArrivals: params.get('new') === 'true',
    page: boundedInt(params.get('page'), 1, 10000),
    pageSize: boundedInt(params.get('pageSize'), 12, 24),
    sort: ['name', 'updated_at', 'published_at'].includes(sort) ? sort : 'updated_at',
    ascending: params.has('asc') ? params.get('asc') === 'true' : sortValue.endsWith('_asc'),
    attributes: technicalFilters(params),
    cursor: params.get('cursor') || null,
  };
}
export function categoryTree(rows: CatalogCategory[]): CatalogCategory[] {
  const nodes = new Map(rows.map((row) => [row.id, { ...row, children: [] as CatalogCategory[] }]));
  const roots: CatalogCategory[] = [];
  for (const node of nodes.values()) {
    const visited = new Set([node.id]);
    let ancestor = node.parent_id;
    let cycle = false;
    while (ancestor && nodes.has(ancestor)) {
      if (visited.has(ancestor)) {
        cycle = true;
        break;
      }
      visited.add(ancestor);
      ancestor = nodes.get(ancestor)!.parent_id;
    }
    const parent = node.parent_id ? nodes.get(node.parent_id) : null;
    if (parent && !cycle) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}
export function currentPrice<T extends DisplayPrice>(
  price: T | undefined,
  now = Date.now(),
): DisplayPrice {
  if (!price || (price.valid_until && !(new Date(price.valid_until).getTime() > now)))
    return { type: 'on_request' };
  return price;
}
export function priceLabel(price?: DisplayPrice): string {
  const value = currentPrice(price);
  if (value.type === 'on_request' || value.min == null || !value.unit || !value.currency)
    return 'Price on request';
  const min = Number(value.min),
    max = Number(value.max ?? value.min);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min)
    return 'Price on request';
  const format = (n: number) => n.toLocaleString('en-BD', { maximumFractionDigits: 4 });
  return `${value.currency} ${format(min)}${max !== min ? ` – ${format(max)}` : ''} / ${value.unit}`;
}
export function currentVariantPrices(prices: VariantPrice[], now = Date.now()) {
  return prices.filter(
    (price) => !price.valid_until || new Date(price.valid_until).getTime() > now,
  );
}
