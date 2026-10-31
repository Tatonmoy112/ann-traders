import Link from 'next/link';
export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-300 py-10">
      <div className="container-custom flex flex-wrap gap-8 justify-between">
        <div>
          <p className="font-bold text-white">ANN TRADERS</p>
          <p className="text-sm mt-2">Textile, garment and industrial supply - Bangladesh</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-5 text-sm">
          <Link href="/products">Products</Link>
          <Link href="/documents">Technical documents</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <p className="text-xs w-full">
          Published prices are indicative quotations. Confirm current availability, taxes, transport
          and trade terms.
        </p>
      </div>
    </footer>
  );
}
