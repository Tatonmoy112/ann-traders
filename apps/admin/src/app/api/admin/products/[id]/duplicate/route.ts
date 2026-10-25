import { z } from 'zod';
import { requireAdmin, HttpError } from '@/lib/auth';
import { databaseError, failure, json } from '@/lib/http';
import { integrationClient } from '@/lib/privileged';

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const { profile } = await requireAdmin(['super_admin', 'admin', 'editor']);
    const { id } = await context.params;
    z.uuid().parse(id);

    const client = integrationClient();

    // 1. Fetch source product
    const { data: src, error: srcErr } = await client
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (srcErr || !src) throw new HttpError(404, 'Source product not found');

    // 2. Generate unique product code & slug
    let candidateCode = `${src.product_code}-COPY`;
    let candidateSlug = `${src.slug}-copy`;
    let counter = 1;

    while (true) {
      const { data: existing } = await client
        .from('products')
        .select('id')
        .or(`product_code.eq.${candidateCode},slug.eq.${candidateSlug}`)
        .limit(1);

      if (!existing || existing.length === 0) {
        break;
      }
      counter++;
      candidateCode = `${src.product_code}-COPY-${counter}`;
      candidateSlug = `${src.slug}-copy-${counter}`;
    }

    // 3. Create the duplicated product (always as draft)
    const { data: newProd, error: newProdErr } = await client
      .from('products')
      .insert({
        name: `${src.name} (Copy)`,
        product_code: candidateCode,
        slug: candidateSlug,
        product_type: src.product_type,
        primary_category_id: src.primary_category_id,
        brand_id: src.brand_id,
        country_of_origin: src.country_of_origin,
        short_description: src.short_description,
        description: src.description,
        key_features: src.key_features,
        seo_title: src.seo_title,
        seo_description: src.seo_description,
        is_featured: false,
        is_new_arrival: false,
        status: 'draft',
        created_by: profile.id,
        updated_by: profile.id,
        revision: 1,
      })
      .select('id')
      .single();

    if (newProdErr || !newProd) databaseError(newProdErr ?? { message: 'Failed to create duplicate product' });

    const newProductId = newProd.id;

    // 4. Duplicate Variants
    const { data: srcVariants, error: varErr } = await client
      .from('product_variants')
      .select('*')
      .eq('product_id', src.id);

    if (varErr) databaseError(varErr);

    const variantIdMap = new Map<string, string>();

    if (srcVariants && srcVariants.length > 0) {
      for (let i = 0; i < srcVariants.length; i++) {
        const sv = srcVariants[i];
        let varSku = `${sv.sku}-COPY`;
        let varCounter = 1;

        while (true) {
          const { data: exSku } = await client
            .from('product_variants')
            .select('id')
            .eq('sku', varSku)
            .limit(1);
          if (!exSku || exSku.length === 0) break;
          varCounter++;
          varSku = `${sv.sku}-COPY-${varCounter}`;
        }

        const { data: newVar, error: insVarErr } = await client
          .from('product_variants')
          .insert({
            product_id: newProductId,
            sku: varSku,
            variant_name: sv.variant_name,
            model_number: sv.model_number,
            manufacturer_part_number: sv.manufacturer_part_number,
            base_unit_id: sv.base_unit_id,
            minimum_order_qty: sv.minimum_order_qty,
            minimum_order_unit_id: sv.minimum_order_unit_id,
            monthly_supply_capacity: sv.monthly_supply_capacity,
            capacity_unit_id: sv.capacity_unit_id,
            lead_time_days: sv.lead_time_days,
            availability_status: sv.availability_status,
            is_default: sv.is_default,
            is_active: sv.is_active,
            sort_order: sv.sort_order,
          })
          .select('id')
          .single();

        if (insVarErr || !newVar) databaseError(insVarErr ?? { message: 'Failed to duplicate variant' });
        variantIdMap.set(sv.id, newVar.id);
      }
    }

    // 5. Duplicate Prices & Tiers
    const oldVariantIds = Array.from(variantIdMap.keys());
    if (oldVariantIds.length > 0) {
      const { data: srcPrices } = await client
        .from('variant_prices')
        .select('*')
        .in('variant_id', oldVariantIds);

      if (srcPrices && srcPrices.length > 0) {
        for (const sp of srcPrices) {
          const newVarId = variantIdMap.get(sp.variant_id);
          if (!newVarId) continue;

          const { data: newPrice, error: priceErr } = await client
            .from('variant_prices')
            .insert({
              variant_id: newVarId,
              currency_code: sp.currency_code,
              price_type: sp.price_type,
              min_price: sp.min_price,
              max_price: sp.max_price,
              price_unit_id: sp.price_unit_id,
              trade_term: sp.trade_term,
              valid_from: new Date().toISOString(),
              valid_until: sp.valid_until,
              is_active: sp.is_active,
            })
            .select('id')
            .single();

          if (priceErr || !newPrice) continue;

          // Duplicate Price Tiers
          const { data: srcTiers } = await client
            .from('price_tiers')
            .select('*')
            .eq('variant_price_id', sp.id);

          if (srcTiers && srcTiers.length > 0) {
            await client.from('price_tiers').insert(
              srcTiers.map((t) => ({
                variant_price_id: newPrice.id,
                min_quantity: t.min_quantity,
                max_quantity: t.max_quantity,
                quantity_unit_id: t.quantity_unit_id,
                unit_price: t.unit_price,
                sort_order: t.sort_order,
              })),
            );
          }
        }
      }

      // 6. Duplicate Variant Packaging
      const { data: srcPkg } = await client
        .from('variant_packaging')
        .select('*')
        .in('variant_id', oldVariantIds);

      if (srcPkg && srcPkg.length > 0) {
        await client.from('variant_packaging').insert(
          srcPkg.map((p) => ({
            variant_id: variantIdMap.get(p.variant_id)!,
            packaging_type: p.packaging_type,
            pack_quantity: p.pack_quantity,
            pack_unit_id: p.pack_unit_id,
            package_description: p.package_description,
            is_default: p.is_default,
          })),
        );
      }

      // 7. Duplicate Fiber Composition
      const { data: srcFibers } = await client
        .from('variant_fiber_composition')
        .select('*')
        .in('variant_id', oldVariantIds);

      if (srcFibers && srcFibers.length > 0) {
        await client.from('variant_fiber_composition').insert(
          srcFibers.map((f) => ({
            variant_id: variantIdMap.get(f.variant_id)!,
            fiber_id: f.fiber_id,
            percentage: f.percentage,
          })),
        );
      }

      // 8. Duplicate Equipment Compatibility
      const { data: srcEq } = await client
        .from('variant_equipment_compatibility')
        .select('*')
        .in('variant_id', oldVariantIds);

      if (srcEq && srcEq.length > 0) {
        await client.from('variant_equipment_compatibility').insert(
          srcEq.map((e) => ({
            variant_id: variantIdMap.get(e.variant_id)!,
            equipment_model_id: e.equipment_model_id,
            compatibility_notes: e.compatibility_notes,
          })),
        );
      }

      // 9. Duplicate Variant Attribute Values
      const { data: srcVarAttrs } = await client
        .from('variant_attribute_values')
        .select('*')
        .in('variant_id', oldVariantIds);

      if (srcVarAttrs && srcVarAttrs.length > 0) {
        await client.from('variant_attribute_values').insert(
          srcVarAttrs.map((a) => ({
            variant_id: variantIdMap.get(a.variant_id)!,
            attribute_id: a.attribute_id,
            option_id: a.option_id,
            value_text: a.value_text,
            value_number: a.value_number,
            value_boolean: a.value_boolean,
            unit_id: a.unit_id,
          })),
        );
      }
    }

    // 10. Duplicate Product Attribute Values
    const { data: srcProdAttrs } = await client
      .from('product_attribute_values')
      .select('*')
      .eq('product_id', src.id);

    if (srcProdAttrs && srcProdAttrs.length > 0) {
      await client.from('product_attribute_values').insert(
        srcProdAttrs.map((a) => ({
          product_id: newProductId,
          attribute_id: a.attribute_id,
          option_id: a.option_id,
          value_text: a.value_text,
          value_number: a.value_number,
          value_boolean: a.value_boolean,
          unit_id: a.unit_id,
        })),
      );
    }

    // 11. Duplicate Product Taxonomy Relations
    const [extraCats, industries, applications, certifications] = await Promise.all([
      client.from('product_extra_categories').select('category_id').eq('product_id', src.id),
      client.from('product_industries').select('industry_id').eq('product_id', src.id),
      client.from('product_applications').select('application_id').eq('product_id', src.id),
      client
        .from('product_certifications')
        .select('certification_id, certificate_number, valid_until, document_id')
        .eq('product_id', src.id),
    ]);

    if (extraCats.data?.length) {
      await client.from('product_extra_categories').insert(
        extraCats.data.map((c) => ({ product_id: newProductId, category_id: c.category_id })),
      );
    }
    if (industries.data?.length) {
      await client.from('product_industries').insert(
        industries.data.map((i) => ({ product_id: newProductId, industry_id: i.industry_id })),
      );
    }
    if (applications.data?.length) {
      await client.from('product_applications').insert(
        applications.data.map((a) => ({ product_id: newProductId, application_id: a.application_id })),
      );
    }
    if (certifications.data?.length) {
      await client.from('product_certifications').insert(
        certifications.data.map((c) => ({
          product_id: newProductId,
          certification_id: c.certification_id,
          certificate_number: c.certificate_number,
          valid_until: c.valid_until,
          document_id: c.document_id,
        })),
      );
    }

    return json({ id: newProductId }, 201);
  } catch (e) {
    return failure(e);
  }
}
