'use client';
import { useState } from 'react';
import type { CatalogProduct, CatalogVariant } from '@/lib/types';
import { VolumeTierMatrix } from './volume-tier-matrix';
import { ProductSpecsTable } from './product-specs-table';
export function ProductVariants({
  product,
  variants,
}: {
  product: CatalogProduct;
  variants: CatalogVariant[];
}) {
  const [selected, setSelected] = useState(
    variants.find((variant) => variant.is_default)?.id || variants[0]?.id,
  );
  const variant = variants.find((item) => item.id === selected) || variants[0];
  if (!variant) return <p>Variant information available on request.</p>;
  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="product-variant" className="block text-sm font-semibold">
          Variant
        </label>
        <select
          id="product-variant"
          value={variant.id}
          onChange={(event) => setSelected(event.target.value)}
          className="block w-full border rounded-lg p-2 mt-2"
        >
          {variants.map((item) => (
            <option key={item.id} value={item.id}>
              {item.variant_name} - {item.sku}
            </option>
          ))}
        </select>
      </div>
      <p className="text-sm">
        Minimum order: {variant.minimum_order_qty || 'On request'} {variant.minimum_order_unit}
      </p>
      <p className="text-sm">Availability: {variant.availability_status.replaceAll('_', ' ')}</p>
      <VolumeTierMatrix prices={variant.prices} />
      <ProductSpecsTable product={product} variant={variant} />
      {!!variant.composition?.length && (
        <div>
          <h3 className="font-semibold">Fiber composition</h3>
          {variant.composition.map((item) => (
            <p className="text-sm" key={item.fiber}>
              {item.fiber}: {item.percentage}%
            </p>
          ))}
        </div>
      )}
      {!!variant.equipment?.length && (
        <div>
          <h3 className="font-semibold">Equipment compatibility</h3>
          {variant.equipment.map((item, index) => (
            <p className="text-sm" key={index}>
              {item.brand} {item.model}
              {item.notes ? ` — ${item.notes}` : ''}
            </p>
          ))}
        </div>
      )}
      {!!variant.packaging?.length && (
        <div>
          <h3 className="font-semibold">Packaging</h3>
          {variant.packaging.map((pack, index) => (
            <p className="text-sm" key={index}>
              {pack.type}: {pack.quantity} {pack.unit} {pack.description}
            </p>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-500">
        Confirm quotation validity, quantity, taxes, transport and trade terms before ordering.
      </p>
    </div>
  );
}
