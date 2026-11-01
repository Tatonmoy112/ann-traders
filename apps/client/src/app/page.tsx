import { connection } from 'next/server';
import { Suspense } from 'react';
import { getCategories, getProducts } from '@/lib/catalog';
import { parseCatalogFilters } from '@/lib/catalog-contract';
import { HeroBanner } from '@/components/home/hero-banner';
import { CategoryShowcase } from '@/components/home/category-showcase';
import { FeaturedProducts } from '@/components/home/featured-products';
import { NewArrivals } from '@/components/home/new-arrivals';
import { ValueProps } from '@/components/home/value-props';
import { CtaBanner } from '@/components/home/cta-banner';
async function publishedHomeData() {
  try {
    return await Promise.all([
      getCategories(),
      getProducts(parseCatalogFilters(new URLSearchParams('featured=true&pageSize=3'))),
      getProducts(parseCatalogFilters(new URLSearchParams('new=true&pageSize=3'))),
    ]);
  } catch {
    console.warn('Published homepage catalog could not be loaded.');
    return null;
  }
}
async function PublishedHomeCatalog() {
  const data = await publishedHomeData();
  if (!data) {
    return (
      <>
        <div className="container-custom py-8" role="status">
          Product listings are temporarily unavailable. Please try again shortly or contact us for
          product information.
        </div>
        <ValueProps />
      </>
    );
  }
  const [categories, featured, arrivals] = data;
  return (
    <>
      <CategoryShowcase categories={categories} />
      <FeaturedProducts products={featured.products} />
      <ValueProps />
      <NewArrivals products={arrivals.products} />
    </>
  );
}
export default async function Home() {
  await connection();
  return (
    <div>
      <HeroBanner />
      <Suspense fallback={<ValueProps />}>
        <PublishedHomeCatalog />
      </Suspense>
      <CtaBanner />
    </div>
  );
}
