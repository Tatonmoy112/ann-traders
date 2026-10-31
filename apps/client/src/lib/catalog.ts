import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { serverSupabase } from './supabase';
import { catalogQueryError } from './catalog-errors';
import { publicImageUrl } from './catalog-media';
import {
  categoryTree,
  currentPrice,
  currentVariantPrices,
  type CatalogFilters,
} from './catalog-contract';
import type {
  CatalogProduct,
  CatalogCategory,
  CatalogBrand,
  ProductListResponse,
  ProductDetailResponse,
  CatalogDocument,
} from './types';

export const CATALOG_TAG = 'public-catalog-v2';
const TTL = 30;
const databaseSource = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || 'unconfigured';
// Rotating keys bound freshness even when an upstream refresh fails. The
// revalidate option alone permits stale-while-revalidate beyond the nominal TTL.
const epoch = () => Math.floor(Date.now() / (TTL * 1000));
const CARD_COLUMNS =
  'id,slug,name,product_code,short_description,product_type,country_of_origin,is_featured,is_new_arrival,category_name,category_slug,brand_name,image_url,image_key,published_at,updated_at,display_price';
function checked<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw catalogQueryError(result.error);
  return result.data as T;
}
const cachedCards = unstable_cache(
  async (filters: CatalogFilters, _epoch: number) => {
    void _epoch;
    const result = await serverSupabase()
      .rpc(
        'list_product_cards',
        {
          category_filter: filters.category,
          brand_filter: filters.brand,
          search_query: filters.search,
          featured_only: filters.featured,
          new_only: filters.newArrivals,
          page_number: filters.page,
          page_size: filters.pageSize,
          sort_field: filters.sort,
          sort_ascending: filters.ascending,
        },
        { get: true },
      )
      .select(CARD_COLUMNS);
    return checked(result) as unknown as CatalogProduct[];
  },
  ['public-cards-v2', databaseSource],
  { tags: [CATALOG_TAG], revalidate: TTL },
);
async function visibleIds(ids: string[]) {
  if (!ids.length) return new Set<string>();
  const data = checked(await serverSupabase().from('visibility').select('id').in('id', ids));
  return new Set((data || []).map((row) => row.id as string));
}
export async function getProducts(filters: CatalogFilters): Promise<ProductListResponse> {
  const rows = await cachedCards(filters, epoch());
  const visible = await visibleIds(rows.map((row) => row.id));
  return {
    products: rows
      .slice(0, filters.pageSize)
      .filter((row) => visible.has(row.id))
      .map((row) => ({
        ...row,
        image_url: publicImageUrl(row.image_url, process.env.R2_PUBLIC_BASE_URL),
        display_price: currentPrice(row.display_price),
      })),
    total: null,
    totalPages: null,
    page: filters.page,
    pageSize: filters.pageSize,
    hasMore: rows.length > filters.pageSize,
  };
}
const cachedCategories = unstable_cache(
  async (_epoch: number) => (
    void _epoch,
    checked(
      await serverSupabase()
        .from('categories')
        .select('id,name,slug,description,parent_id,image_path,sort_order')
        .order('sort_order')
        .order('name')
        .order('id')
        .limit(500),
    ) as CatalogCategory[]
  ),
  ['public-categories-v2', databaseSource],
  { tags: [CATALOG_TAG], revalidate: TTL },
);
const cachedBrands = unstable_cache(
  async (_epoch: number) => (
    void _epoch,
    checked(
      await serverSupabase()
        .from('brands')
        .select('id,name,slug,country_code,logo_path')
        .order('name')
        .order('id')
        .limit(500),
    ) as CatalogBrand[]
  ),
  ['public-brands-v2', databaseSource],
  { tags: [CATALOG_TAG], revalidate: TTL },
);
export async function getCategories(tree = false) {
  const rows = await cachedCategories(epoch());
  return tree ? categoryTree(rows) : rows;
}
export async function getBrands() {
  return cachedBrands(epoch());
}
const cachedDetail = unstable_cache(
  async (slug: string, _epoch: number, _revision: string) => {
    void _epoch;
    void _revision;
    const result = await serverSupabase()
      .from('product_details')
      .select('product,variants,documents,gallery')
      .eq('slug', slug)
      .maybeSingle();
    return checked(result) as ProductDetailResponse | null;
  },
  ['public-detail-v2', databaseSource],
  { tags: [CATALOG_TAG], revalidate: TTL },
);
export const getProduct = cache(async (slug: string): Promise<ProductDetailResponse | null> => {
  if (!/^[a-z0-9_-]{1,280}$/i.test(slug)) return null;
  // Reject unknown/draft slugs before allocating a shared cache entry. Published
  // revisions isolate republished content from older cached relationships.
  const visible = checked<{ id: string; revision: number } | null>(
    await serverSupabase().from('visibility').select('id,revision').eq('slug', slug).maybeSingle(),
  );
  if (!visible) return null;
  const data = await cachedDetail(slug, epoch(), String(visible.revision));
  if (!data || data.product.id !== visible.id) return null;
  const images = (items: NonNullable<CatalogProduct['image_variants']>) =>
    items.flatMap((item) => {
      const url = publicImageUrl(item.url, process.env.R2_PUBLIC_BASE_URL);
      return url ? [{ ...item, url }] : [];
    });
  return {
    ...data,
    product: {
      ...data.product,
      image_url: publicImageUrl(data.product.image_url, process.env.R2_PUBLIC_BASE_URL),
      image_variants: images(data.product.image_variants || []),
    },
    gallery: images(data.gallery || []),
    variants: data.variants.map((variant) => ({
      ...variant,
      prices: currentVariantPrices(variant.prices),
    })),
  };
});
export async function getDocuments(params: URLSearchParams) {
  const number = (key: string, fallback: number, max: number) => {
    const n = Number(params.get(key));
    return Number.isSafeInteger(n) && n > 0 ? Math.min(n, max) : fallback;
  };
  const page = number('page', 1, 10000),
    pageSize = number('pageSize', 20, 24);
  let query = serverSupabase()
    .from('documents')
    .select(
      'id,product_id,variant_id,title,document_type,file_extension,bytes,product_name,product_code,product_slug',
      { count: 'exact' },
    );
  const type = params.get('type')?.slice(0, 40);
  const q = params
    .get('q')
    ?.slice(0, 80)
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, ' ')
    .trim();
  if (type && type !== 'all') query = query.eq('document_type', type);
  if (q) query = query.ilike('title', `%${q}%`);
  const result = await query
    .order('created_at', { ascending: false })
    .order('id')
    .range((page - 1) * pageSize, page * pageSize - 1);
  const documents = checked(result) as CatalogDocument[];
  return {
    documents,
    total: result.count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((result.count || 0) / pageSize),
  };
}
