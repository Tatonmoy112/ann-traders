import Link from 'next/link';
import { ProductCard } from '@/components/catalog/product-card';
import type { CatalogProduct } from '@/lib/types';
export function FeaturedProducts({ products }: { products: CatalogProduct[] }) {
  return (
    <section className="container-custom py-12">
      <div className="flex justify-between mb-6">
        <h2 className="text-2xl font-bold">Featured products</h2>
        <Link href="/products?featured=true">View all</Link>
      </div>
      {products.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <p className="text-slate-600">No featured products are currently published.</p>
      )}
    </section>
  );
}
