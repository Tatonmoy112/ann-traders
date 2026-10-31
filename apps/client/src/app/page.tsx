import { connection } from 'next/server';
import { getCategories, getProducts } from '@/lib/catalog';
import { parseCatalogFilters } from '@/lib/catalog-contract';
import { HeroBanner } from '@/components/home/hero-banner';
import { CategoryShowcase } from '@/components/home/category-showcase';
import { FeaturedProducts } from '@/components/home/featured-products';
import { NewArrivals } from '@/components/home/new-arrivals';
import { ValueProps } from '@/components/home/value-props';
import { CtaBanner } from '@/components/home/cta-banner';
export default async function Home() {
  await connection();
  const [categories, featured, arrivals] = await Promise.all([
    getCategories(),
    getProducts(parseCatalogFilters(new URLSearchParams('featured=true&pageSize=3'))),
    getProducts(parseCatalogFilters(new URLSearchParams('new=true&pageSize=3'))),
  ]);
  return (
    <div>
      <HeroBanner />
      <CategoryShowcase categories={categories} />
      <FeaturedProducts products={featured.products} />
      <ValueProps />
      <NewArrivals products={arrivals.products} />
      <CtaBanner />
    </div>
  );
}
