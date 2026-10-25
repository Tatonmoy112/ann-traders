'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '@/lib/api';
import { useRfq } from '@/components/rfq/rfq-context';
import type { CatalogDocument } from '@/lib/types';
import {
  FileText,
  Download,
  ShieldCheck,
  Search,
  X,
  FileCheck2,
  ChevronRight,
  Loader2,
  FileSpreadsheet,
  Building,
} from 'lucide-react';

function DocumentsContent() {
  const { openRfq } = useRfq();
  const [selectedType, setSelectedType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['catalog', 'documents', selectedType, searchTerm],
    queryFn: () =>
      catalogApi.getDocuments({
        type: selectedType === 'all' ? undefined : selectedType,
        search: searchTerm || undefined,
        pageSize: 30,
      }),
    staleTime: 60 * 1000,
  });

  const documents = data?.documents || [];
  const total = data?.total || 0;

  const docTypes = [
    { label: 'All Compliance Documents', value: 'all' },
    { label: 'Technical Data Sheets (TDS)', value: 'TDS' },
    { label: 'Safety Data Sheets (MSDS / SDS)', value: 'MSDS' },
    { label: 'OEKO-TEX & Test Certificates', value: 'certificate' },
    { label: 'Catalogues & Specs', value: 'catalogue' },
  ];

  const formatBytes = (bytes?: number | null) => {
    if (!bytes) return 'PDF Document';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-slate-50 min-h-screen py-8 sm:py-12">
      <div className="container-custom space-y-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/" className="hover:text-blue-600 transition">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-800 font-semibold">
            Compliance & Technical Repository
          </span>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Factory Audit Verification</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Technical Data Sheets & Compliance Documents
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              Official Technical Data Sheets (TDS), Material Safety Data Sheets (MSDS), and international OEKO-TEX® Standard 100 test reports.
            </p>
          </div>

          <button
            type="button"
            onClick={() => openRfq()}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm rounded-xl transition shadow-xs flex items-center gap-2 shrink-0 self-start md:self-auto"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Request Custom Lab Report</span>
          </button>
        </div>

        {/* Toolbar: Document Type Filter & Search Input */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Document Type Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            {docTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setSelectedType(type.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  selectedType === type.value
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search document title..."
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-blue-600"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Documents Grid */}
        {isLoading ? (
          <div className="py-20 text-center text-slate-400 flex items-center justify-center gap-2 text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span>Loading technical document library...</span>
          </div>
        ) : documents.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
              <FileCheck2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Official documents available upon inquiry
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                Need factory compliance certificates or batch-specific TDS for European/US retail buyer audits? Submit a request with your factory details and our QA desk will issue signed PDFs.
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => openRfq()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition inline-flex items-center gap-1.5 shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Submit Technical Requisition</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc: CatalogDocument) => (
              <div
                key={doc.id}
                className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                      {doc.document_type}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {formatBytes(doc.bytes)}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                    {doc.title}
                  </h3>

                  {doc.product_name && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                      Material: <span className="font-semibold text-slate-700">{doc.product_name}</span>
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  {doc.product_slug ? (
                    <Link
                      href={`/products/${doc.product_slug}`}
                      className="text-xs font-semibold text-slate-600 hover:text-blue-600 transition"
                    >
                      View Specs →
                    </Link>
                  ) : <span />}

                  <a
                    href={doc.download_url || `/api/catalog/documents/${doc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense
      fallback={
        <div className="container-custom py-20 text-center text-slate-400">
          Loading compliance repository...
        </div>
      }
    >
      <DocumentsContent />
    </Suspense>
  );
}

