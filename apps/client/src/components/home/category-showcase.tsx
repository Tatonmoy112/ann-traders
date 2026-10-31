import Link from 'next/link';
import type { CatalogCategory } from '@/lib/types';
export function CategoryShowcase({ categories }: { categories: CatalogCategory[] }) {
  return (
    <section className="container-custom py-12">
      <h2 className="text-2xl font-bold mb-6">Browse by category</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/products?category=${encodeURIComponent(category.slug)}`}
            className="p-5 rounded-xl bg-white border border-slate-200"
          >
            <h3 className="font-semibold">{category.name}</h3>
            {category.description && (
              <p className="text-sm text-slate-600 mt-2">{category.description}</p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
