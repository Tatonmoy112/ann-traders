import 'server-only';
import { serverSupabase } from './supabase';
import { catalogQueryError } from './catalog-errors';
import { InvalidCatalogFilter, type CatalogFilters } from './catalog-contract';
import type { Json } from '@ann/database';
import type { CatalogProduct, CatalogFacet } from './types';

// Older installed catalogs expose only the original, published-only listing RPC.
// Fall back exclusively when PostgREST says this specific new RPC is absent.
// Permission errors, missing views and upstream failures must still fail closed.
export async function readCatalogCards(filters: CatalogFilters, afterCursor?: Json) {
  const db = serverSupabase();
  const args = {
    category_filter: filters.category,
    brand_filter: filters.brand,
    search_query: filters.search,
    featured_only: filters.featured,
    new_only: filters.newArrivals,
    page_number: filters.page,
    page_size: filters.pageSize,
    sort_field: filters.sort,
    sort_ascending: filters.ascending,
  };
  const result = await db.rpc(
    'browse_product_cards',
    {
      ...args,
      // PostgREST GET needs explicit JSON text, not JS array serialization.
      attribute_filters: JSON.stringify(filters.attributes),
      after_cursor: afterCursor ? JSON.stringify(afterCursor) : undefined,
    },
    { get: true },
  );
  if (!result.error)
    return result.data as unknown as { rows: CatalogProduct[]; next_cursor: unknown };
  if (result.error.code !== 'PGRST202') throw catalogQueryError(result.error);
  if (filters.attributes.length || afterCursor)
    throw new InvalidCatalogFilter(
      'These filters or this page link require the catalog update. Clear filters and browse again.',
    );
  const legacy = await db.rpc('list_product_cards', args, { get: true });
  if (legacy.error) throw catalogQueryError(legacy.error);
  return { rows: (legacy.data || []) as unknown as CatalogProduct[], next_cursor: null };
}

export async function readCatalogFacets(category: string): Promise<CatalogFacet[]> {
  const result = await serverSupabase().rpc(
    'category_filters',
    { category_filter: category },
    { get: true },
  );
  if (result.error?.code === 'PGRST202') return [];
  if (result.error) throw catalogQueryError(result.error);
  return result.data as unknown as CatalogFacet[];
}
