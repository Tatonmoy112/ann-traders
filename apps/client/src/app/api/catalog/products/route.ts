import { NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase';
import { safeErrorMessage } from '@/lib/security';
import type { CatalogProduct } from '@/lib/types';

interface RawProductData {
  id: string;
  name: string;
  slug: string;
  product_code: string;
  short_description: string | null;
  description: string | null;
  product_type: string;
  country_of_origin: string | null;
  is_featured: boolean;
  is_new_arrival: boolean;
  published_at: string;
  updated_at: string;
  categories: { name: string; slug: string } | null;
  brands: { name: string; slug: string; logo_path?: string | null } | null;
  product_media: {
    id: string;
    is_primary: boolean;
    upload_status: string;
    delivery_url: string | null;
    object_manifest?: { kind: string; url: string; width: number; height: number; key: string }[];
  }[];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category')?.trim().slice(0, 80);
    const brand = searchParams.get('brand')?.trim().slice(0, 80);
    const rawSearch = searchParams.get('q')?.trim().slice(0, 80);
    // Sanitize search to prevent SQL pattern injection
    const search = rawSearch ? rawSearch.replace(/[,%()]/g, ' ').trim() : null;
    const featured = searchParams.get('featured') === 'true';
    const newArrivals = searchParams.get('new') === 'true';
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') || 12)));
    const sort = searchParams.get('sort') || 'updated_at';
    const ascending = searchParams.get('asc') === 'true';

    const db = serverSupabase();

    let query = db
      .from('products')
      .select(
        `
        id,
        name,
        slug,
        product_code,
        short_description,
        description,
        product_type,
        country_of_origin,
        is_featured,
        is_new_arrival,
        published_at,
        updated_at,
        categories:primary_category_id (name, slug),
        brands:brand_id (name, slug, logo_path),
        product_media (id, is_primary, upload_status, delivery_url, object_manifest)
      `,
        { count: 'exact' },
      )
      .eq('status', 'published')
      .is('deleted_at', null);

    // Filter by category slug
    if (category) {
      // Find category id by slug first or filter by match
      const { data: cat } = await db
        .from('categories')
        .select('id')
        .eq('slug', category)
        .maybeSingle();

      if (cat) {
        query = query.eq('primary_category_id', cat.id);
      }
    }

    // Filter by brand slug or name
    if (brand) {
      const { data: b } = await db
        .from('brands')
        .select('id')
        .or(`slug.eq.${brand},name.ilike.%${brand}%`)
        .maybeSingle();

      if (b) {
        query = query.eq('brand_id', b.id);
      }
    }

    // Search query on name, code, description
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,product_code.ilike.%${search}%,short_description.ilike.%${search}%`,
      );
    }

    // Filter by featured
    if (featured) {
      query = query.eq('is_featured', true);
    }

    // Filter by new arrivals
    if (newArrivals) {
      query = query.eq('is_new_arrival', true);
    }

    // Sorting
    const allowedSorts = ['name', 'updated_at', 'published_at'];
    const sortField = allowedSorts.includes(sort) ? sort : 'updated_at';
    query = query.order(sortField, { ascending });

    // Bounded range pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Catalog products query error:', error);
      return NextResponse.json(
        { error: safeErrorMessage(error, 'Failed to fetch catalog products') },
        { status: 500 },
      );
    }

    const rawRows = (data as unknown as RawProductData[]) || [];
    const products: CatalogProduct[] = rawRows.map((p) => {
      const primaryMedia =
        p.product_media?.find((m) => m.is_primary && m.upload_status === 'ready') ??
        p.product_media?.find((m) => m.upload_status === 'ready');

      const imageVariants = (primaryMedia?.object_manifest || []).map((m) => ({
        kind: (m.kind as 'thumbnail' | 'card' | 'detail') || 'detail',
        url: m.url,
        width: m.width || 800,
        height: m.height || 800,
        key: m.key || '',
      }));

      const cardVariant = imageVariants.find((m) => m.kind === 'card');

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        product_code: p.product_code,
        short_description: p.short_description,
        description: p.description,
        product_type: p.product_type,
        country_of_origin: p.country_of_origin,
        is_featured: p.is_featured,
        is_new_arrival: p.is_new_arrival,
        category_name: p.categories?.name || 'General Category',
        category_slug: p.categories?.slug || 'general',
        brand_name: p.brands?.name || null,
        image_url: cardVariant?.url || primaryMedia?.delivery_url || null,
        image_variants: imageVariants,
        image_key: cardVariant?.key || null,
        published_at: p.published_at,
        updated_at: p.updated_at,
      };
    });

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);

    return NextResponse.json({
      products,
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (err) {
    const message = safeErrorMessage(err, 'Failed to fetch catalog products');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

