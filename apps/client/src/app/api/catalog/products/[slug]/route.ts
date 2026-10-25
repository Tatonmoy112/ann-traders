import { NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase';
import { safeErrorMessage } from '@/lib/security';
import type {
  CatalogProduct,
  CatalogVariant,
  CatalogDocument,
  ImageVariant,
  PriceTier,
  VariantPrice,
  VariantSpecification,
  ProductDetailResponse,
} from '@/lib/types';

interface RawUnit {
  name?: string | null;
  code?: string | null;
  symbol?: string | null;
}

interface RawManifestItem {
  kind?: string;
  url: string;
  width?: number;
  height?: number;
  key?: string;
}

interface RawMedia {
  id: string;
  is_primary: boolean;
  upload_status: string;
  sort_order: number;
  delivery_url: string | null;
  object_manifest?: RawManifestItem[] | null;
}

interface RawPriceTier {
  id: string;
  variant_price_id: string;
  min_quantity: number;
  max_quantity: number | null;
  unit_price: number;
  sort_order: number;
}

interface RawVariantPrice {
  id: string;
  variant_id: string;
  currency_code: string;
  price_type: string;
  min_price: number | null;
  max_price: number | null;
  trade_term: string | null;
  valid_until: string | null;
  price_unit: RawUnit | null;
}

interface RawSpec {
  variant_id: string;
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  attribute_definitions: { code: string; name: string } | null;
  option: { value: string; label: string } | null;
  units: { code: string; symbol: string } | null;
}

interface RawVariant {
  id: string;
  product_id: string;
  sku: string;
  variant_name: string;
  model_number: string | null;
  manufacturer_part_number: string | null;
  minimum_order_qty: number | null;
  monthly_supply_capacity: number | null;
  lead_time_days: number | null;
  availability_status: string;
  is_default: boolean;
  sort_order: number;
  base_unit: RawUnit | null;
  min_unit: RawUnit | null;
  cap_unit: RawUnit | null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    if (!slug || !/^[a-z0-9-_]+$/i.test(slug) || slug.length > 120) {
      return NextResponse.json({ error: 'Invalid product slug' }, { status: 400 });
    }

    const db = serverSupabase();

    // 1. Fetch published product by slug
    const { data: rawProduct, error: prodErr } = await db
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
        brands:brand_id (name, slug, logo_path)
      `,
      )
      .eq('slug', slug)
      .eq('status', 'published')
      .is('deleted_at', null)
      .maybeSingle();

    if (prodErr) {
      console.error('Error fetching product by slug:', prodErr);
      return NextResponse.json(
        { error: safeErrorMessage(prodErr, 'Failed to fetch product details') },
        { status: 500 },
      );
    }

    if (!rawProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // 2. Fetch media, variants, and public documents in parallel
    const [mediaRes, variantsRes, documentsRes] = await Promise.all([
      db
        .from('product_media')
        .select('id, is_primary, upload_status, sort_order, delivery_url, object_manifest')
        .eq('product_id', rawProduct.id)
        .eq('upload_status', 'ready')
        .is('retired_at', null)
        .order('is_primary', { ascending: false })
        .order('sort_order', { ascending: true }),
      db
        .from('product_variants')
        .select(
          `
          id,
          product_id,
          sku,
          variant_name,
          model_number,
          manufacturer_part_number,
          minimum_order_qty,
          monthly_supply_capacity,
          lead_time_days,
          availability_status,
          is_default,
          sort_order,
          base_unit:base_unit_id (name, code, symbol),
          min_unit:minimum_order_unit_id (name, code, symbol),
          cap_unit:capacity_unit_id (name, code, symbol)
        `,
        )
        .eq('product_id', rawProduct.id)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('sort_order', { ascending: true }),
      db
        .from('product_documents')
        .select('id, product_id, variant_id, title, document_type, file_extension, bytes')
        .eq('product_id', rawProduct.id)
        .eq('is_public', true)
        .order('sort_order', { ascending: true }),
    ]);

    // 3. Process media gallery and primary image
    const rawMediaList = (mediaRes.data as unknown as RawMedia[]) || [];
    const gallery: ImageVariant[] = [];
    let primaryVariants: ImageVariant[] = [];
    let primaryCardUrl: string | null = null;
    let primaryKey: string | null = null;

    for (const media of rawMediaList) {
      const manifests = (media.object_manifest || []).map((m) => ({
        kind: (m.kind as 'thumbnail' | 'card' | 'detail') || 'detail',
        url: m.url,
        width: m.width || 800,
        height: m.height || 800,
        key: m.key || '',
      }));

      // Find detail variant or first URL for gallery
      const detailVariant =
        manifests.find((m) => m.kind === 'detail') ||
        manifests[0] ||
        (media.delivery_url
          ? {
              kind: 'detail' as const,
              url: media.delivery_url,
              width: 800,
              height: 800,
              key: '',
            }
          : null);

      if (detailVariant) {
        gallery.push(detailVariant);
      }

      if (media.is_primary && primaryVariants.length === 0) {
        primaryVariants = manifests;
        const card = manifests.find((m) => m.kind === 'card') || manifests[0];
        primaryCardUrl = card?.url || media.delivery_url || null;
        primaryKey = card?.key || null;
      }
    }

    // Fallback if no primary media was explicitly marked
    if (!primaryCardUrl && gallery.length > 0) {
      primaryCardUrl = gallery[0].url;
      primaryKey = gallery[0].key;
    }

    // 4. Fetch variant prices, tiers, and specifications
    const rawVariants = (variantsRes.data as unknown as RawVariant[]) || [];
    const variantIds = rawVariants.map((v) => v.id);

    let rawPrices: RawVariantPrice[] = [];
    let rawTiers: RawPriceTier[] = [];
    let rawSpecs: RawSpec[] = [];

    if (variantIds.length > 0) {
      const [pricesRes, specsRes] = await Promise.all([
        db
          .from('variant_prices')
          .select(
            `
            id,
            variant_id,
            currency_code,
            price_type,
            min_price,
            max_price,
            trade_term,
            valid_until,
            price_unit:price_unit_id (name, code, symbol)
          `,
          )
          .in('variant_id', variantIds)
          .eq('is_active', true),
        db
          .from('variant_attribute_values')
          .select(
            `
            variant_id,
            value_text,
            value_number,
            value_boolean,
            attribute_definitions (code, name),
            option:attribute_options!variant_attribute_values_option_id_fkey (value, label),
            units (code, symbol)
          `,
          )
          .in('variant_id', variantIds),
      ]);

      rawPrices = (pricesRes.data as unknown as RawVariantPrice[]) || [];
      rawSpecs = (specsRes.data as unknown as RawSpec[]) || [];

      const priceIds = rawPrices.map((p) => p.id);
      if (priceIds.length > 0) {
        const { data: tiersData } = await db
          .from('price_tiers')
          .select('id, variant_price_id, min_quantity, max_quantity, unit_price, sort_order')
          .in('variant_price_id', priceIds)
          .order('min_quantity', { ascending: true });

        rawTiers = (tiersData as unknown as RawPriceTier[]) || [];
      }
    }

    // Group tiers by variant_price_id
    const tiersByPriceId = new Map<string, PriceTier[]>();
    for (const tier of rawTiers) {
      const list = tiersByPriceId.get(tier.variant_price_id) || [];
      list.push({
        min_quantity: String(tier.min_quantity),
        max_quantity: tier.max_quantity !== null ? String(tier.max_quantity) : null,
        unit_price: String(tier.unit_price),
        unit: 'unit',
      });
      tiersByPriceId.set(tier.variant_price_id, list);
    }

    // Group prices by variant_id
    const pricesByVariantId = new Map<string, VariantPrice[]>();
    for (const price of rawPrices) {
      const unitLabel = price.price_unit?.symbol || price.price_unit?.code || 'unit';
      const tiers = (tiersByPriceId.get(price.id) || []).map((t) => ({
        ...t,
        unit: unitLabel,
      }));

      const item: VariantPrice = {
        id: price.id,
        currency: price.currency_code,
        type: price.price_type,
        min: price.min_price !== null ? String(price.min_price) : null,
        max: price.max_price !== null ? String(price.max_price) : null,
        unit: unitLabel,
        trade_term: price.trade_term,
        valid_until: price.valid_until,
        tiers,
      };

      const list = pricesByVariantId.get(price.variant_id) || [];
      list.push(item);
      pricesByVariantId.set(price.variant_id, list);
    }

    // Group specs by variant_id
    const specsByVariantId = new Map<string, VariantSpecification[]>();
    for (const spec of rawSpecs) {
      if (!spec.attribute_definitions) continue;
      const item: VariantSpecification = {
        code: spec.attribute_definitions.code,
        label: spec.attribute_definitions.name,
        text: spec.value_text,
        number: spec.value_number !== null ? String(spec.value_number) : null,
        boolean: spec.value_boolean,
        option: spec.option?.label || spec.option?.value || null,
        unit: spec.units?.symbol || spec.units?.code || null,
      };

      const list = specsByVariantId.get(spec.variant_id) || [];
      list.push(item);
      specsByVariantId.set(spec.variant_id, list);
    }

    // Assemble CatalogVariant objects
    const variants: CatalogVariant[] = rawVariants.map((v) => {
      const saleUnit = v.base_unit?.symbol || v.base_unit?.code || 'unit';
      const minOrderUnit = v.min_unit?.symbol || v.min_unit?.code || saleUnit;
      const capacityUnit = v.cap_unit?.symbol || v.cap_unit?.code || saleUnit;

      return {
        id: v.id,
        product_id: v.product_id,
        sku: v.sku,
        variant_name: v.variant_name,
        model_number: v.model_number,
        manufacturer_part_number: v.manufacturer_part_number,
        sale_unit: saleUnit,
        minimum_order_qty: v.minimum_order_qty !== null ? String(v.minimum_order_qty) : '1',
        minimum_order_unit: minOrderUnit,
        monthly_supply_capacity:
          v.monthly_supply_capacity !== null ? String(v.monthly_supply_capacity) : '0',
        capacity_unit: capacityUnit,
        lead_time_days: v.lead_time_days,
        availability_status: v.availability_status || 'available',
        is_default: v.is_default,
        prices: pricesByVariantId.get(v.id) || [],
        specifications: specsByVariantId.get(v.id) || [],
      };
    });

    // Assemble Documents with download URLs
    const rawDocs = (documentsRes.data as unknown as CatalogDocument[]) || [];
    const documents: CatalogDocument[] = rawDocs.map((doc) => ({
      id: doc.id,
      product_id: doc.product_id,
      variant_id: doc.variant_id,
      title: doc.title,
      document_type: doc.document_type,
      file_extension: doc.file_extension || 'pdf',
      bytes: doc.bytes || null,
      download_url: `/api/catalog/documents/${doc.id}`,
    }));

    // Assemble Product
    const categoriesData = rawProduct.categories as unknown as { name: string; slug: string } | null;
    const brandsData = rawProduct.brands as unknown as {
      name: string;
      slug: string;
      logo_path?: string | null;
    } | null;

    const product: CatalogProduct = {
      id: rawProduct.id,
      name: rawProduct.name,
      slug: rawProduct.slug,
      product_code: rawProduct.product_code,
      short_description: rawProduct.short_description,
      description: rawProduct.description,
      product_type: rawProduct.product_type,
      country_of_origin: rawProduct.country_of_origin,
      is_featured: rawProduct.is_featured,
      is_new_arrival: rawProduct.is_new_arrival,
      category_name: categoriesData?.name || 'General Category',
      category_slug: categoriesData?.slug || 'general',
      brand_name: brandsData?.name || null,
      image_url: primaryCardUrl,
      image_variants: primaryVariants,
      image_key: primaryKey,
      published_at: rawProduct.published_at,
      updated_at: rawProduct.updated_at,
    };

    const responseData: ProductDetailResponse = {
      product,
      variants,
      documents,
      gallery,
    };

    return NextResponse.json(responseData);
  } catch (err) {
    const message = safeErrorMessage(err, 'Failed to fetch product details');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

