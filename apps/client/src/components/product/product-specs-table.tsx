import React from 'react';
import type { CatalogVariant, CatalogProduct } from '@/lib/types';
import { Sliders, CheckCircle2 } from 'lucide-react';

interface ProductSpecsTableProps {
  product: CatalogProduct;
  variant?: CatalogVariant;
}

export function ProductSpecsTable({ product, variant }: ProductSpecsTableProps) {
  const variantCodes = new Set(variant?.specifications.map((spec) => spec.code) || []);
  const specs = [
    ...(product.specifications || []).filter((spec) => !variantCodes.has(spec.code)),
    ...(variant?.specifications || []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
        <Sliders className="w-4 h-4 text-blue-600" />
        <span>Technical Specification Sheet</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <tbody className="divide-y divide-slate-100">
            {/* Core Identification */}
            <tr className="bg-slate-50/50">
              <td className="py-2.5 px-4 font-semibold text-slate-500 w-1/3">Product Code / SKU</td>
              <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                {variant?.sku || product.product_code}
              </td>
            </tr>

            {variant?.model_number && (
              <tr>
                <td className="py-2.5 px-4 font-semibold text-slate-500">Model / Grade Number</td>
                <td className="py-2.5 px-4 text-slate-800">{variant.model_number}</td>
              </tr>
            )}

            {variant?.manufacturer_part_number && (
              <tr>
                <td className="py-2.5 px-4 font-semibold text-slate-500">
                  Manufacturer Part No (MPN)
                </td>
                <td className="py-2.5 px-4 font-mono text-slate-800">
                  {variant.manufacturer_part_number}
                </td>
              </tr>
            )}

            <tr>
              <td className="py-2.5 px-4 font-semibold text-slate-500">Material Category</td>
              <td className="py-2.5 px-4 text-slate-800 font-medium">{product.category_name}</td>
            </tr>

            {product.brand_name && (
              <tr>
                <td className="py-2.5 px-4 font-semibold text-slate-500">Brand / Indentor</td>
                <td className="py-2.5 px-4 text-slate-800 font-semibold">{product.brand_name}</td>
              </tr>
            )}

            {product.country_of_origin && (
              <tr>
                <td className="py-2.5 px-4 font-semibold text-slate-500">Country of Origin</td>
                <td className="py-2.5 px-4 text-slate-800">{product.country_of_origin}</td>
              </tr>
            )}

            {/* Commercial Supply Metrics */}
            {variant && (
              <>
                <tr>
                  <td className="py-2.5 px-4 font-semibold text-slate-500">
                    Minimum Order Quantity (MOQ)
                  </td>
                  <td className="py-2.5 px-4 text-slate-800 font-bold">
                    {variant.minimum_order_qty
                      ? `${variant.minimum_order_qty} ${variant.minimum_order_unit}`
                      : 'On request'}
                  </td>
                </tr>

                {variant.monthly_supply_capacity && variant.monthly_supply_capacity !== '0' && (
                  <tr>
                    <td className="py-2.5 px-4 font-semibold text-slate-500">
                      Monthly Supply Capacity
                    </td>
                    <td className="py-2.5 px-4 text-slate-800">
                      {Number(variant.monthly_supply_capacity).toLocaleString()}{' '}
                      {variant.capacity_unit} / month
                    </td>
                  </tr>
                )}

                {variant.lead_time_days !== null && (
                  <tr>
                    <td className="py-2.5 px-4 font-semibold text-slate-500">
                      Delivery / Indent Lead Time
                    </td>
                    <td className="py-2.5 px-4 text-slate-800">
                      {variant.lead_time_days} days (confirm current delivery terms)
                    </td>
                  </tr>
                )}

                <tr>
                  <td className="py-2.5 px-4 font-semibold text-slate-500">Availability Status</td>
                  <td className="py-2.5 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      {variant.availability_status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              </>
            )}

            {/* Dynamic Technical Attributes */}
            {specs.map((spec, sIdx) => {
              const val =
                spec.option ||
                spec.text ||
                (spec.number ? `${spec.number} ${spec.unit || ''}` : null) ||
                (spec.boolean !== null ? (spec.boolean ? 'Yes' : 'No') : '—');

              return (
                <tr key={sIdx}>
                  <td className="py-2.5 px-4 font-semibold text-slate-500">{spec.label}</td>
                  <td className="py-2.5 px-4 text-slate-900 font-medium">{val}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
