'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { catalogApi, type ProductQueryFilters } from '@/lib/api';
import { ProductCard } from '@/components/catalog/product-card';
import { CatalogFilterSidebar } from '@/components/catalog/catalog-filter-sidebar';
import { CatalogToolbar } from '@/components/catalog/catalog-toolbar';
import { CatalogPagination } from '@/components/catalog/catalog-pagination';
import type { CatalogProduct } from '@/lib/types';
import {
  ChevronRight,
  Package,
  RotateCcw,
  SlidersHorizontal,
  X,
  Loader2,
  Boxes,
} from 'lucide-react';

function CatalogContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read URL query parameters
  const categoryParam = searchParams.get('category') || undefined;
  const brandParam = searchParams.get('brand') || undefined;
  const searchParam = searchParams.get('q') || '';
  const featuredParam = searchParams.get('featured') === 'true';
  const newParam = searchParams.get('new') === 'true';
  const pageParam = Math.max(1, Number(searchParams.get('page') || 1));
  const sortParam = searchParams.get('sort') || 'updated_at_desc';

  // Mobile filter drawer state
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Helper to push updated query parameters to router
  const updateUrlParams = (updates: Record<string, string | undefined | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ''}`);
  };

  // Convert sort dropdown key into api sort field and asc flag
  const getSortConfig = (sortKey: string): { sort: 'name' | 'updated_at' | 'published_at'; ascending: boolean } => {
    switch (sortKey) {
      case 'published_at_desc':
        return { sort: 'published_at', ascending: false };
      case 'name_asc':
        return { sort: 'name', ascending: true };
      case 'name_desc':
        return { sort: 'name', ascending: false };
      case 'updated_at_desc':
      default:
        return { sort: 'updated_at', ascending: false };
    }
  };

  const sortConfig = getSortConfig(sortParam);

  // Query parameters for Axios API
  const apiFilters: ProductQueryFilters = {
    category: categoryParam,
    brand: brandParam,
    search: searchParam || undefined,
    featured: featuredParam || undefined,
    newArrivals: newParam || undefined,
    page: pageParam,
    pageSize: 12,
    sort: sortConfig.sort,
    ascending: sortConfig.ascending,
  };

  // TanStack Query fetching through Axios catalogApi
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['catalog', 'products', apiFilters],
    queryFn: () => catalogApi.getProducts(apiFilters),
    staleTime: 60 * 1000,
  });

  const products = data?.products || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  // Filter actions
  const handleSelectCategory = (slug?: string) => {
    updateUrlParams({ category: slug, page: '1' });
    setMobileFiltersOpen(false);
  };

  const handleSelectBrand = (slug?: string) => {
    updateUrlParams({ brand: slug, page: '1' });
    setMobileFiltersOpen(false);
  };

  const handleToggleFeatured = (featured: boolean) => {
    updateUrlParams({ featured: featured ? 'true' : undefined, page: '1' });
  };

  const handleToggleNewArrivals = (newArrivals: boolean) => {
    updateUrlParams({ new: newArrivals ? 'true' : undefined, page: '1' });
  };

  const handleSearchChange = (query: string) => {
    updateUrlParams({ q: query || undefined, page: '1' });
  };

  const handleSortChange = (sort: string) => {
    updateUrlParams({ sort, page: '1' });
  };

  const handlePageChange = (newPage: number) => {
    updateUrlParams({ page: String(newPage) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetFilters = () => {
    router.push('/products');
    setMobileFiltersOpen(false);
  };

  // Compute active filter tags
  const activeTags: { label: string; onRemove: () => void }[] = [];
  if (categoryParam) {
    activeTags.push({
      label: `Category: ${categoryParam}`,
      onRemove: () => handleSelectCategory(undefined),
    });
  }
  if (brandParam) {
    activeTags.push({
      label: `Brand: ${brandParam}`,
      onRemove: () => handleSelectBrand(undefined),
    });
  }
  if (searchParam) {
    activeTags.push({
      label: `Keyword: "${searchParam}"`,
      onRemove: () => handleSearchChange(''),
    });
  }
  if (featuredParam) {
    activeTags.push({
      label: 'Featured Only',
      onRemove: () => handleToggleFeatured(false),
    });
  }
  if (newParam) {
    activeTags.push({
      label: 'New Arrivals Only',
      onRemove: () => handleToggleNewArrivals(false),
    });
  }

  const activeFilterCount = activeTags.length;

  return (
    <div className="bg-slate-50 min-h-screen py-8 sm:py-12">
      <div className="container-custom">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs text-slate-500 mb-6">
          <Link href="/" className="hover:text-blue-600 transition">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <Link href="/products" className="hover:text-blue-600 transition font-medium">
            Industrial Catalog
          </Link>
          {categoryParam && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-800 font-semibold capitalize">
                {categoryParam.replace(/-/g, ' ')}
              </span>
            </>
          )}
        </nav>

        {/* Page Title & Scope Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            {categoryParam
              ? `${categoryParam.replace(/-/g, ' ').toUpperCase()} Raw Materials`
              : 'Industrial Materials Catalog'}
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Direct mill sourcing & ready spot inventory for Bangladesh ready-made garments factories, knitting units, and dye houses.
          </p>
        </div>

        {/* Main Layout Grid: Left Sidebar (3 Cols) + Right Grid (9 Cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Desktop Filter Sidebar */}
          <div className="hidden lg:block lg:col-span-3 sticky top-28 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
            <CatalogFilterSidebar
              selectedCategory={categoryParam}
              selectedBrand={brandParam}
              isFeatured={featuredParam}
              isNewArrivals={newParam}
              onSelectCategory={handleSelectCategory}
              onSelectBrand={handleSelectBrand}
              onToggleFeatured={handleToggleFeatured}
              onToggleNewArrivals={handleToggleNewArrivals}
              onResetFilters={handleResetFilters}
            />
          </div>

          {/* Right Product Grid Area */}
          <div className="lg:col-span-9">
            {/* Toolbar: Search, Sort, Active Tag Pills */}
            <CatalogToolbar
              total={total}
              searchQuery={searchParam}
              sortValue={sortParam}
              onSearchChange={handleSearchChange}
              onSortChange={handleSortChange}
              onOpenMobileFilters={() => setMobileFiltersOpen(true)}
              activeFilterCount={activeFilterCount}
              activeTags={activeTags}
              onClearAll={handleResetFilters}
            />

            {/* Error View */}
            {isError && (
              <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-sm">
                <p className="font-bold">Failed to load catalog materials.</p>
                <p className="text-xs mt-1 text-rose-600">{(error as Error)?.message}</p>
              </div>
            )}

            {/* Loading Skeletons */}
            {isLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 animate-pulse"
                  >
                    <div className="aspect-4/3 bg-slate-200 rounded-xl" />
                    <div className="space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-1/3" />
                      <div className="h-5 bg-slate-200 rounded w-4/5" />
                      <div className="h-3 bg-slate-200 rounded w-full" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty Results View */}
            {!isLoading && !isError && products.length === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                  <Package className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">No matching materials found</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    No products currently match your active filters or keyword search. Try broadening your criteria or reset filters.
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset All Filters</span>
                  </button>
                </div>
              </div>
            )}

            {/* Active Products Grid */}
            {!isLoading && !isError && products.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {products.map((product: CatalogProduct) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {/* Pagination Controls */}
                <CatalogPagination
                  currentPage={pageParam}
                  totalPages={totalPages}
                  totalItems={total}
                  pageSize={12}
                  onPageChange={handlePageChange}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filter Slide-Over Drawer */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <div className="relative w-4/5 max-w-sm bg-white h-full shadow-2xl flex flex-col z-10 overflow-y-auto">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-sm">Filter Materials</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 flex-1">
              <CatalogFilterSidebar
                selectedCategory={categoryParam}
                selectedBrand={brandParam}
                isFeatured={featuredParam}
                isNewArrivals={newParam}
                onSelectCategory={handleSelectCategory}
                onSelectBrand={handleSelectBrand}
                onToggleFeatured={handleToggleFeatured}
                onToggleNewArrivals={handleToggleNewArrivals}
                onResetFilters={handleResetFilters}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="container-custom py-20 text-center text-slate-400 flex items-center justify-center gap-2 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span>Loading catalog portal...</span>
        </div>
      }
    >
      <CatalogContent />
    </Suspense>
  );
}

