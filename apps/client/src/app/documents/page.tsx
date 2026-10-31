import { connection } from 'next/server';
import Link from 'next/link';
import { getDocuments } from '@/lib/catalog';
import { ProductDocuments } from '@/components/product/product-documents';
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    if (typeof value === 'string') params.set(key, value);
  const data = await getDocuments(params);
  const href = (page: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(page));
    return `/documents?${next}`;
  };
  return (
    <div className="container-custom py-10 space-y-6">
      <h1 className="text-3xl font-bold">Technical documentation</h1>
      <p className="text-slate-600">
        Browse published document references. Contact us for the relevant files and current
        certification details.
      </p>
      <form className="flex flex-wrap gap-4" action="/documents">
        <label>
          Search
          <input
            className="block border p-2 rounded"
            name="q"
            defaultValue={params.get('q') || ''}
          />
        </label>
        <label>
          Type
          <select
            className="block border p-2 rounded"
            name="type"
            defaultValue={params.get('type') || 'all'}
          >
            <option value="all">All</option>
            <option value="TDS">TDS</option>
            <option value="MSDS">MSDS</option>
            <option value="certificate">Certificate</option>
          </select>
        </label>
        <button className="bg-blue-700 text-white rounded px-4">Search documents</button>
      </form>
      <ProductDocuments documents={data.documents} />
      <nav aria-label="Document pagination" className="flex justify-between">
        {data.page > 1 ? <Link href={href(data.page - 1)}>Previous page</Link> : <span />}
        {data.page < data.totalPages && <Link href={href(data.page + 1)}>Next page</Link>}
      </nav>
    </div>
  );
}
