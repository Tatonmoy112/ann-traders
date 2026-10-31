'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '@/lib/api';
import type { CatalogCategory, CatalogBrand } from '@/lib/types';
import { Layers, Building2, Sparkles, Clock, RotateCcw, Check, Filter } from 'lucide-react';

interface CatalogFilterSidebarProps {
  selectedCategory?: string;
  selectedBrand?: string;
  isFeatured?: boolean;
  isNewArrivals?: boolean;
  onSelectCategory: (categorySlug?: string) => void;
  onSelectBrand: (brandSlug?: string) => void;
  onToggleFeatured: (featured: boolean) => void;
  onToggleNewArrivals: (newArrivals: boolean) => void;
  onResetFilters: () => void;
  className?: string;
}

export function CatalogFilterSidebar({
  selectedCategory,
  selectedBrand,
  isFeatured,
  isNewArrivals,
  onSelectCategory,
  onSelectBrand,
  onToggleFeatured,
  onToggleNewArrivals,
  onResetFilters,
  className = '',
}: CatalogFilterSidebarProps) {
  // 1. Fetch categories
  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: ['catalog', 'categories'],
    queryFn: () => catalogApi.getCategories(),
    staleTime: 5 * 60 * 1000,
  });

  // 2. Fetch brands
  const { data: brands = [], isLoading: brandLoading } = useQuery({
    queryKey: ['catalog', 'brands'],
    queryFn: () => catalogApi.getBrands(),
    staleTime: 5 * 60 * 1000,
  });

  const hasActiveFilters = Boolean(
    selectedCategory || selectedBrand || isFeatured || isNewArrivals,
  );

  return (
    <aside className={`space-y-6 ${className}`}>
      {/* Header & Reset Button */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <Filter className="w-4 h-4 text-blue-600" />
          <span>Filter Sourcing Specs</span>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset All</span>
          </button>
        )}
      </div>

      {/* Special Highlights Filter */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
          Special Highlights
        </label>
        <div className="space-y-1.5">
          <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-100 cursor-pointer text-xs font-medium text-slate-700 transition">
            <input
              type="checkbox"
              checked={Boolean(isFeatured)}
              onChange={(e) => onToggleFeatured(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
            />
            <span className="flex items-center gap-1.5 flex-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Featured Factory Items</span>
            </span>
          </label>

          <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-100 cursor-pointer text-xs font-medium text-slate-700 transition">
            <input
              type="checkbox"
              checked={Boolean(isNewArrivals)}
              onChange={(e) => onToggleNewArrivals(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
            />
            <span className="flex items-center gap-1.5 flex-1">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>New Spot Arrivals</span>
            </span>
          </label>
        </div>
      </div>

      {/* Material Categories Filter */}
      <div className="space-y-2 pt-2 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>Material Sectors</span>
          </label>
          {selectedCategory && (
            <button
              type="button"
              onClick={() => onSelectCategory(undefined)}
              className="text-[11px] font-semibold text-blue-600 hover:underline"
            >
              Clear
            </button>
          )}
        </div>

        <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
          {/* All Categories Option */}
          <button
            type="button"
            onClick={() => onSelectCategory(undefined)}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              !selectedCategory
                ? 'bg-blue-50 text-blue-700 font-bold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span>All Sectors</span>
            {!selectedCategory && <Check className="w-3.5 h-3.5 text-blue-600" />}
          </button>

          {catLoading ? (
            <div className="text-xs text-slate-400 py-3 text-center">Loading sectors...</div>
          ) : (
            categories.map((cat: CatalogCategory) => {
              const isSelected = selectedCategory === cat.slug;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onSelectCategory(isSelected ? undefined : cat.slug)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="truncate pr-2">{cat.name}</span>
                  {cat.product_count !== undefined && cat.product_count > 0 ? (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                        isSelected ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {cat.product_count}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Brands Filter */}
      <div className="space-y-2 pt-2 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Brand Partners</span>
          </label>
          {selectedBrand && (
            <button
              type="button"
              onClick={() => onSelectBrand(undefined)}
              className="text-[11px] font-semibold text-blue-600 hover:underline"
            >
              Clear
            </button>
          )}
        </div>

        <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
          {/* All Brands Option */}
          <button
            type="button"
            onClick={() => onSelectBrand(undefined)}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              !selectedBrand
                ? 'bg-blue-50 text-blue-700 font-bold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span>All Brands</span>
            {!selectedBrand && <Check className="w-3.5 h-3.5 text-blue-600" />}
          </button>

          {brandLoading ? (
            <div className="text-xs text-slate-400 py-3 text-center">Loading brands...</div>
          ) : (
            brands.map((brand: CatalogBrand) => {
              const isSelected = selectedBrand === brand.slug;
              return (
                <button
                  key={brand.id}
                  type="button"
                  onClick={() => onSelectBrand(isSelected ? undefined : brand.slug)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="truncate pr-2">{brand.name}</span>
                  {brand.product_count !== undefined && brand.product_count > 0 ? (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                        isSelected ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {brand.product_count}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
