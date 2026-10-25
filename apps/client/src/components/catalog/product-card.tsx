'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { CatalogProduct } from '@/lib/types';
import { useRfq } from '@/components/rfq/rfq-context';
import { Package, ArrowRight, FileSpreadsheet, ShieldCheck, Sparkles, Tag } from 'lucide-react';

interface ProductCardProps {
  product: CatalogProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const { openRfq } = useRfq();
  const [imageError, setImageError] = useState(false);

  // Determine display image: card variant url or primary image url
  const cardVariant = product.image_variants?.find((v) => v.kind === 'card');
  const imageUrl = cardVariant?.url || product.image_url;

  return (
    <div className="group bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-xl hover:border-blue-400 transition-all duration-300 flex flex-col overflow-hidden">
      {/* Product Image Area */}
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-4/3 bg-slate-100 overflow-hidden"
      >
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={product.name}
            onError={() => setImageError(true)}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 p-4 text-center">
            <Package className="w-12 h-12 stroke-[1.25] text-slate-400 group-hover:text-blue-500 transition-colors" />
            <span className="text-[11px] font-semibold text-slate-500 mt-2 uppercase tracking-wider">
              {product.category_name}
            </span>
          </div>
        )}

        {/* Floating Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 z-10">
          {product.is_featured && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-xs">
              <Sparkles className="w-3 h-3" /> Featured
            </span>
          )}
          {product.is_new_arrival && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-xs">
              New Arrival
            </span>
          )}
        </div>

        {/* Product Code Badge */}
        <div className="absolute bottom-2.5 right-2.5 z-10">
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-900/85 backdrop-blur-xs text-white">
            {product.product_code}
          </span>
        </div>
      </Link>

      {/* Content Area */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Category & Brand Meta */}
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span className="font-semibold text-blue-600 uppercase tracking-wider text-[11px]">
              {product.category_name}
            </span>
            {product.brand_name && (
              <span className="font-medium text-slate-500 truncate max-w-[120px]">
                {product.brand_name}
              </span>
            )}
          </div>

          {/* Product Title */}
          <h3 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
            <Link href={`/products/${product.slug}`}>{product.name}</Link>
          </h3>

          {/* Short Description */}
          {product.short_description && (
            <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 leading-relaxed">
              {product.short_description}
            </p>
          )}

          {/* Industrial Specs Pill */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
            {product.country_of_origin && (
              <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                Origin: {product.country_of_origin}
              </span>
            )}
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium">
              <Tag className="w-3 h-3 text-emerald-600" /> Volume Tier Pricing
            </span>
          </div>
        </div>

        {/* Actions Area */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <Link
            href={`/products/${product.slug}`}
            className="text-xs font-semibold text-slate-700 hover:text-blue-600 inline-flex items-center gap-1 transition group-hover:translate-x-0.5"
          >
            <span>View Specs</span>
            <ArrowRight className="w-3 h-3" />
          </Link>

          <button
            type="button"
            onClick={() =>
              openRfq({
                id: product.id,
                name: product.name,
                sku: product.product_code,
              })
            }
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 border border-blue-200/80 hover:border-transparent"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>RFQ Quote</span>
          </button>
        </div>
      </div>
    </div>
  );
}

