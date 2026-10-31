import Link from 'next/link';
import { ProductCard } from '@/components/catalog/product-card';
import type { CatalogProduct } from '@/lib/types';
export function NewArrivals({ products }: { products: CatalogProduct[] }) {
  if (!products.length) return null;
  return (
    <section className="container-custom py-12">
      <div className="flex justify-between mb-6">
        <h2 className="text-2xl font-bold">New arrivals</h2>
        <Link href="/products?new=true">View all</Link>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
