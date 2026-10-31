'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="container-custom py-16 space-y-4">
      <h1 className="text-xl font-bold">Catalog temporarily unavailable</h1>
      <p>Please try again shortly.</p>
      <button onClick={reset} className="px-4 py-2 bg-blue-700 text-white rounded">
        Try again
      </button>
    </div>
  );
}
