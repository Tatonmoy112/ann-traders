import Link from 'next/link';
export function CtaBanner() {
  return (
    <section className="bg-blue-950 text-white py-16 text-center">
      <div className="container-custom space-y-5">
        <h2 className="text-3xl font-bold">Discuss your sourcing requirements</h2>
        <p>Share the product specifications, quantity and unit you need.</p>
        <Link
          href="/contact"
          className="inline-block bg-white text-blue-900 px-6 py-3 rounded-xl font-semibold"
        >
          Contact ANN Traders
        </Link>
      </div>
    </section>
  );
}
