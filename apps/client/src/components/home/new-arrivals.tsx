'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '@/lib/api';
import { ProductCard } from '@/components/catalog/product-card';
import type { CatalogProduct } from '@/lib/types';
import { Clock, ArrowRight, Loader2, Sparkles } from 'lucide-react';

export function NewArrivals() {
  const { data, isLoading } = useQuery({
    queryKey: ['catalog', 'products', 'newArrivals'],
    queryFn: async () => {
      const res = await catalogApi.getProducts({ newArrivals: true, pageSize: 3 });
      if (res.products && res.products.length > 0) {
        return res;
      }
      return catalogApi.getProducts({ sort: 'published_at', pageSize: 3 });
    },
    staleTime: 5 * 60 * 1000,
  });

  const products = data?.products || [];

  if (!isLoading && products.length === 0) return null;

  return (
    <section className="py-14 sm:py-20 bg-slate-50 border-b border-slate-200">
      <div className="container-custom">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Ready Spot Inventory</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              New Spot Arrivals & Indent Lots
            </h2>
            <p className="text-sm text-slate-600 mt-1 max-w-xl">
              Freshly cleared warehouse inventory ready for same-day dispatch to Dhaka and Narayanganj factories.
            </p>
          </div>
          <Link
            href="/products?new=true"
            className="text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1.5 shrink-0 group"
          >
            <span>View All New Arrivals</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span>Loading recent arrivals...</span>
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

