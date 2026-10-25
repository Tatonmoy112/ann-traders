import React from 'react';
import type { CatalogDocument } from '@/lib/types';
import { FileText, Download, ShieldCheck, FileCheck, ExternalLink } from 'lucide-react';

interface ProductDocumentsProps {
  documents: CatalogDocument[];
}

export function ProductDocuments({ documents }: ProductDocumentsProps) {
  if (!documents || documents.length === 0) {
    return (
      <div className="p-5 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-center space-y-2">
        <FileText className="w-8 h-8 text-slate-400 mx-auto" />
        <p className="text-xs font-semibold text-slate-700">
          Technical compliance documents available upon request
        </p>
        <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
          Need official TDS, OEKO-TEX® certificates, or MSDS for factory compliance audits? Submit an inquiry and our technical division will issue verified PDFs.
        </p>
      </div>
    );
  }

  // Format bytes to readable MB / KB
  const formatBytes = (bytes?: number | null) => {
    if (!bytes) return 'PDF Document';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
        <ShieldCheck className="w-4 h-4 text-emerald-600" />
        <span>Verified Compliance & Technical Downloads</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {documents.map((doc) => {
          const downloadUrl = doc.download_url || `/api/catalog/documents/${doc.id}`;

          return (
            <div
              key={doc.id}
              className="p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all flex items-start justify-between gap-3 group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 mb-1">
                    {doc.document_type}
                  </span>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 transition leading-snug line-clamp-1">
                    {doc.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {doc.file_extension?.toUpperCase() || 'PDF'} · {formatBytes(doc.bytes)}
                  </p>
                </div>
              </div>

              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition shrink-0"
                aria-label={`Download ${doc.title}`}
                title="Download verified document"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}

