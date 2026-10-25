'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '@/lib/api';
import type { CatalogCategory } from '@/lib/types';
import {
  Layers,
  ArrowRight,
  Scissors,
  Droplets,
  PackageCheck,
  Cpu,
  Boxes,
  Loader2,
} from 'lucide-react';

export function CategoryShowcase() {
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['catalog', 'categories'],
    queryFn: () => catalogApi.getCategories(),
    staleTime: 5 * 60 * 1000,
  });

  // Helper to map category slugs to appropriate industrial icons
  const getCategoryIcon = (slug: string) => {
    if (slug.includes('fabric') || slug.includes('yarn')) {
      return <Layers className="w-6 h-6 text-blue-600" />;
    }
    if (slug.includes('cad') || slug.includes('paper')) {
      return <Scissors className="w-6 h-6 text-emerald-600" />;
    }
    if (slug.includes('dye') || slug.includes('chemical')) {
      return <Droplets className="w-6 h-6 text-indigo-600" />;
    }
    if (slug.includes('packaging')) {
      return <PackageCheck className="w-6 h-6 text-amber-600" />;
    }
    if (slug.includes('machinery')) {
      return <Cpu className="w-6 h-6 text-rose-600" />;
    }
    return <Boxes className="w-6 h-6 text-blue-600" />;
  };

  return (
    <section className="py-14 sm:py-20 bg-slate-50 border-b border-slate-200">
      <div className="container-custom">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              <Layers className="w-3.5 h-3.5" />
              <span>Sourcing Divisions</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Procurement By Production Sector
            </h2>
            <p className="text-sm text-slate-600 mt-1 max-w-xl">
              From raw spinning fibers and cutting-room CAD paper to post-dyeing auxiliaries and export carton packaging.
            </p>
          </div>
          <Link
            href="/products"
            className="text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1.5 shrink-0 group"
          >
            <span>View All Materials</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Categories Grid */}
        {isLoading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span>Loading sourcing divisions...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {categories.map((cat: CatalogCategory) => (
              <Link
                key={cat.id}
                href={`/products?category=${encodeURIComponent(cat.slug)}`}
                className="group bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Icon & Count Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:bg-blue-50/60 transition-colors">
                      {getCategoryIcon(cat.slug)}
                    </div>
                    {cat.product_count !== undefined && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 group-hover:bg-blue-100 text-slate-600 group-hover:text-blue-700 transition">
                        {cat.product_count} {cat.product_count === 1 ? 'Product' : 'Products'}
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                    {cat.name}
                  </h3>
                  {cat.description && (
                    <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                      {cat.description}
                    </p>
                  )}
                </div>

                {/* Explore Link */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600 group-hover:text-blue-600 transition-colors">
                  <span>Explore Materials</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

