'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '@/lib/api';
import { ProductCard } from '@/components/catalog/product-card';
import type { CatalogProduct } from '@/lib/types';
import { Sparkles, ArrowRight, Loader2, Package } from 'lucide-react';

export function FeaturedProducts() {
  const { data, isLoading } = useQuery({
    queryKey: ['catalog', 'products', 'featured'],
    queryFn: async () => {
      // First try featured items
      const res = await catalogApi.getProducts({ featured: true, pageSize: 6 });
      if (res.products && res.products.length >= 2) {
        return res;
      }
      // Fallback to top published items if few are explicitly marked featured
      return catalogApi.getProducts({ pageSize: 6 });
    },
    staleTime: 5 * 60 * 1000,
  });

  const products = data?.products || [];

  return (
    <section className="py-14 sm:py-20 bg-white border-b border-slate-200">
      <div className="container-custom">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>High-Demand RMG Sourcing</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Featured Factory Materials
            </h2>
            <p className="text-sm text-slate-600 mt-1 max-w-xl">
              Export-grade specifications with verified lab test parameters and tiered quantity discounts.
            </p>
          </div>
          <Link
            href="/products?featured=true"
            className="text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1.5 shrink-0 group"
          >
            <span>View All Featured</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span>Loading featured materials...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="py-12 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
            <Package className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-medium">No featured products currently in stock.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product: CatalogProduct) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

