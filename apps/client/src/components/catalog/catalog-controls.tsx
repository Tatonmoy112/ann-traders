'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { CatalogCategory, CatalogBrand } from '@/lib/types';
import type { CatalogFilters } from '@/lib/catalog-contract';
export function CatalogControls({
  categories,
  brands,
  filters,
}: {
  categories: CatalogCategory[];
  brands: CatalogBrand[];
  filters: CatalogFilters;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const sort = `${filters.sort}_${filters.ascending ? 'asc' : 'desc'}`;
  return (
    <form
      action="/products"
      method="get"
      aria-busy={pending}
      className="bg-white border rounded-xl p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const params = new URLSearchParams();
        for (const [key, value] of new FormData(event.currentTarget))
          if (typeof value === 'string') params.set(key, value);
        startTransition(() => router.push(`/products?${params}`));
      }}
    >
      <label className="text-sm">
        Search
        <input
          key={filters.search}
          name="q"
          defaultValue={filters.search}
          maxLength={80}
          className="block border rounded p-2 w-full mt-1"
        />
      </label>
      <label className="text-sm">
        Category
        <select
          key={filters.category}
          name="category"
          defaultValue={filters.category}
          className="block border rounded p-2 w-full mt-1"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Brand
        <select
          key={filters.brand}
          name="brand"
          defaultValue={filters.brand}
          className="block border rounded p-2 w-full mt-1"
        >
          <option value="">All brands</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.slug}>
              {brand.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Sort
        <select
          key={sort}
          name="sort"
          defaultValue={sort}
          className="block border rounded p-2 w-full mt-1"
        >
          <option value="updated_at_desc">Recently updated</option>
          <option value="published_at_desc">Newest published</option>
          <option value="name_asc">Name: A to Z</option>
          <option value="name_desc">Name: Z to A</option>
        </select>
      </label>
      <label className="text-sm">
        <input
          key={String(filters.featured)}
          type="checkbox"
          name="featured"
          value="true"
          defaultChecked={filters.featured}
        />{' '}
        Featured
      </label>
      <label className="text-sm">
        <input
          key={String(filters.newArrivals)}
          type="checkbox"
          name="new"
          value="true"
          defaultChecked={filters.newArrivals}
        />{' '}
        New arrivals
      </label>
      <button
        disabled={pending}
        className="rounded-lg bg-blue-700 text-white px-4 py-2 disabled:opacity-60"
      >
        {pending ? 'Loading...' : 'Apply filters'}
      </button>
      <Link href="/products" className="self-center text-sm text-blue-700">
        Reset filters
      </Link>
    </form>
  );
}
