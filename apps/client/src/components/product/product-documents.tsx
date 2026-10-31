import Link from 'next/link';
import type { CatalogDocument } from '@/lib/types';
export function ProductDocuments({ documents }: { documents: CatalogDocument[] }) {
  return (
    <div className="space-y-3">
      {!documents.length && (
        <p className="text-sm text-slate-600">
          Contact us to ask about available technical documentation.
        </p>
      )}
      {documents.map((doc) => (
        <article
          className="border bg-white rounded-xl p-4 flex flex-wrap justify-between gap-3"
          key={doc.id}
        >
          <div>
            <h3 className="font-semibold">{doc.title}</h3>
            <p className="text-sm text-slate-600">{doc.document_type}</p>
          </div>
          <Link
            href={`/contact?product=${encodeURIComponent(doc.product_code || doc.title)}`}
            className="text-sm text-blue-700"
          >
            Request document
          </Link>
        </article>
      ))}
    </div>
  );
}
