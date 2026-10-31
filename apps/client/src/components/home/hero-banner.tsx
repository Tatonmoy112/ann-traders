import Link from 'next/link';
export function HeroBanner() {
  return (
    <section className="bg-slate-950 text-white py-20">
      <div className="container-custom max-w-5xl space-y-6">
        <p className="text-blue-300">Textile, garment and industrial supply - Bangladesh</p>
        <h1 className="text-4xl sm:text-6xl font-black">
          Find materials for your production needs.
        </h1>
        <p className="text-lg text-slate-300 max-w-2xl">
          Explore product specifications, available variants, units and current price information.
          Contact us to discuss your requirements.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link href="/products" className="bg-blue-600 rounded-xl px-6 py-3 font-bold">
            Browse product catalog
          </Link>
          <Link href="/contact" className="border border-slate-600 rounded-xl px-6 py-3">
            Contact us
          </Link>
        </div>
      </div>
    </section>
  );
}
