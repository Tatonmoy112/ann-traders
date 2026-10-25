import { HeroBanner } from '@/components/home/hero-banner';
import { CategoryShowcase } from '@/components/home/category-showcase';
import { FeaturedProducts } from '@/components/home/featured-products';
import { ValueProps } from '@/components/home/value-props';
import { NewArrivals } from '@/components/home/new-arrivals';
import { CtaBanner } from '@/components/home/cta-banner';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* 1. Hero Showcase with live sourcing metrics */}
      <HeroBanner />

      {/* 2. Sourcing Divisions (Categories) */}
      <CategoryShowcase />

      {/* 3. Featured Factory Materials & High-Demand Stock */}
      <FeaturedProducts />

      {/* 4. Industrial Value Propositions */}
      <ValueProps />

      {/* 5. New Spot Arrivals */}
      <NewArrivals />

      {/* 6. Commercial Indenting CTA Banner */}
      <CtaBanner />
    </div>
  );
}
