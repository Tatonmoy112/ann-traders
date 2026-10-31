export default function Loading() {
  return (
    <div role="status" className="container-custom py-12 animate-pulse">
      <p>Loading products?</p>
      <div className="grid sm:grid-cols-3 gap-6 mt-6">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-80 bg-slate-200 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
