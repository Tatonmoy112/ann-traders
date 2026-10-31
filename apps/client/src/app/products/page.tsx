import type { Metadata } from 'next';
import { connection } from 'next/server';
import Link from 'next/link';
import { getCategories, getBrands, getProducts } from '@/lib/catalog';
import { parseCatalogFilters } from '@/lib/catalog-contract';
import { ProductCard } from '@/components/catalog/product-card';
import { CatalogControls } from '@/components/catalog/catalog-controls';
export const metadata: Metadata = {
  title: 'Product catalog | ANN Traders',
  alternates: { canonical: '/products' },
};
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw))
    if (typeof value === 'string') params.set(key, value);
  params.set('pageSize', '12');
  const filters = parseCatalogFilters(params);
  const [data, categories, brands] = await Promise.all([
    getProducts(filters),
    getCategories(),
    getBrands(),
  ]);
  const pageHref = (page: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(page));
    return `/products?${next}`;
  };
  return (
    <div className="container-custom py-10 space-y-6">
      <nav className="text-sm">
        <Link href="/">Home</Link> / Products
      </nav>
      <h1 className="text-3xl font-bold">Industrial materials catalog</h1>
      <CatalogControls categories={categories} brands={brands} filters={filters} />
      <p className="text-sm text-slate-600">
        Page {data.page} - {data.products.length} products shown
      </p>
      {data.products.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <p>
          No matching products.{' '}
          <Link href="/products" className="text-blue-700">
            Clear filters
          </Link>
        </p>
      )}
      <nav aria-label="Catalog pagination" className="flex justify-between py-4">
        {data.page > 1 ? <Link href={pageHref(data.page - 1)}>Previous page</Link> : <span />}
        {data.hasMore && <Link href={pageHref(data.page + 1)}>Next page</Link>}
      </nav>
    </div>
  );
}
