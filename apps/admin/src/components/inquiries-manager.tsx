'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/client';
import {
  FileSpreadsheet,
  Search,
  CheckCircle2,
  Building,
  User,
  Phone,
  Mail,
  ExternalLink,
  RotateCcw,
  Loader2,
  Check,
  X,
  Copy,
} from 'lucide-react';

export interface InquiryRecord {
  id: string;
  reference_number: string;
  full_name: string;
  company_name: string;
  email: string;
  phone: string;
  product_id: string | null;
  product_name: string;
  variant_sku: string | null;
  target_quantity: number;
  unit: string;
  delivery_term: string | null;
  notes: string | null;
  status: 'new' | 'in_review' | 'quoted' | 'closed';
  admin_notes: string | null;
  quoted_amount: number | null;
  quoted_currency: string | null;
  created_at: string;
  updated_at: string;
}

interface InquiriesResponse {
  rows: InquiryRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: {
    total: number;
    new: number;
    in_review: number;
    quoted: number;
    closed: number;
  };
}

export function InquiriesManager() {
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Active Inquiry Drawer state
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryRecord | null>(null);
  const [editStatus, setEditStatus] = useState<'new' | 'in_review' | 'quoted' | 'closed'>('new');
  const [editNotes, setEditNotes] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCurrency, setEditCurrency] = useState('BDT');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const {
    data,
    isLoading,
    error: queryError,
    refetch: fetchInquiries,
  } = useQuery({
    queryKey: ['inquiries', statusFilter, searchQuery, page],
    queryFn: () => {
      const params = new URLSearchParams({
        status: statusFilter,
        q: searchQuery.trim(),
        page: String(page),
        pageSize: '20',
      });
      return api<InquiriesResponse>('/api/admin/inquiries?' + params);
    },
  });

  // Open drawer and sync edit state
  const handleOpenDrawer = (inq: InquiryRecord) => {
    setSelectedInquiry(inq);
    setEditStatus(inq.status);
    setEditNotes(inq.admin_notes || '');
    setEditAmount(inq.quoted_amount ? String(inq.quoted_amount) : '');
    setEditCurrency(inq.quoted_currency || 'BDT');
    setSaveSuccess(false);
  };

  // Save changes to inquiry
  const handleSaveInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquiry) return;
    setIsSaving(true);
    try {
      await api(`/api/admin/inquiries/${selectedInquiry.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: editStatus,
          admin_notes: editNotes.trim() || null,
          quoted_amount: editAmount ? Number(editAmount) : null,
          quoted_currency: editCurrency,
        }),
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // Refresh list
      fetchInquiries();

      // Update local selected record
      setSelectedInquiry((prev) =>
        prev
          ? {
              ...prev,
              status: editStatus,
              admin_notes: editNotes.trim() || null,
              quoted_amount: editAmount ? Number(editAmount) : null,
              quoted_currency: editCurrency,
            }
          : null,
      );
    } catch (err) {
      setError((err as Error).message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  // Copy RFQ summary to clipboard for WhatsApp/Email
  const handleCopySummary = () => {
    if (!selectedInquiry) return;
    const text = `ANN TRADERS - COMMERCIAL QUOTATION SUMMARY
Reference: ${selectedInquiry.reference_number}
Date: ${new Date(selectedInquiry.created_at).toLocaleDateString()}
Factory: ${selectedInquiry.company_name}
Contact: ${selectedInquiry.full_name} (${selectedInquiry.phone})
Product: ${selectedInquiry.product_name}
Variant SKU: ${selectedInquiry.variant_sku || 'Standard'}
Quantity: ${selectedInquiry.target_quantity} ${selectedInquiry.unit}
Delivery Term: ${selectedInquiry.delivery_term || 'Factory Door'}
Status: ${selectedInquiry.status.toUpperCase()}
${selectedInquiry.quoted_amount ? `Quoted Amount: ${selectedInquiry.quoted_currency} ${selectedInquiry.quoted_amount.toLocaleString()}` : ''}
${selectedInquiry.admin_notes ? `Notes: ${selectedInquiry.admin_notes}` : ''}
`;
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'new':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> New Request
          </span>
        );
      case 'in_review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            In Review
          </span>
        );
      case 'quoted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <Check className="w-3 h-3 text-emerald-600" /> Quoted
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            Closed
          </span>
        );
      default:
        return null;
    }
  };

  const stats = data?.stats || { total: 0, new: 0, in_review: 0, quoted: 0, closed: 0 };
  const rows = data?.rows || [];

  return (
    <div className="space-y-6">
      {(error || queryError) && (
        <div className="alert" role="alert">
          {error || queryError?.message}
        </div>
      )}
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            <span>B2B RFQ & Quotation Inquiries</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Incoming factory procurement requests, volume pricing inquiries, and proforma quote
            management.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchInquiries()}
          className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition inline-flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <button
          type="button"
          onClick={() => {
            setStatusFilter('all');
            setPage(1);
          }}
          className={`p-3.5 rounded-xl border text-left transition ${
            statusFilter === 'all'
              ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            All Inquiries
          </span>
          <span className="text-2xl font-black text-slate-900 mt-0.5 block">{stats.total}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter('new');
            setPage(1);
          }}
          className={`p-3.5 rounded-xl border text-left transition ${
            statusFilter === 'new'
              ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
              New RFQs
            </span>
            {stats.new > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />}
          </div>
          <span className="text-2xl font-black text-amber-900 mt-0.5 block">{stats.new}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter('in_review');
            setPage(1);
          }}
          className={`p-3.5 rounded-xl border text-left transition ${
            statusFilter === 'in_review'
              ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">
            In Review
          </span>
          <span className="text-2xl font-black text-blue-900 mt-0.5 block">{stats.in_review}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter('quoted');
            setPage(1);
          }}
          className={`p-3.5 rounded-xl border text-left transition ${
            statusFilter === 'quoted'
              ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
            Quoted
          </span>
          <span className="text-2xl font-black text-emerald-900 mt-0.5 block">{stats.quoted}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter('closed');
            setPage(1);
          }}
          className={`p-3.5 rounded-xl border text-left transition ${
            statusFilter === 'closed'
              ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-400/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Closed
          </span>
          <span className="text-2xl font-black text-slate-700 mt-0.5 block">{stats.closed}</span>
        </button>
      </div>

      {/* Toolbar Search Box */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by factory name, contact person, product, or RFQ reference..."
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-blue-600"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing <strong className="text-slate-800">{rows.length}</strong> of{' '}
          <strong className="text-slate-800">{data?.total || 0}</strong> inquiries
        </div>
      </div>

      {/* Inquiries Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400 flex items-center justify-center gap-2 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span>Loading inquiries inbox...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">No inquiries found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No quote requests match your active status or search query. Customer inquiries
              submitted via the Client Portal will appear here in real-time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Reference & Date</th>
                  <th className="py-3 px-4">Factory & Contact</th>
                  <th className="py-3 px-4">Material Specification</th>
                  <th className="py-3 px-4">Quantity & Terms</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((inq) => (
                  <tr
                    key={inq.id}
                    className="hover:bg-blue-50/40 transition cursor-pointer"
                    onClick={() => handleOpenDrawer(inq)}
                  >
                    {/* Reference & Date */}
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-blue-700 block text-xs">
                        {inq.reference_number}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(inq.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>

                    {/* Factory & Contact */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{inq.company_name}</div>
                      <div className="text-[11px] text-slate-600 flex items-center gap-1.5 mt-0.5">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{inq.full_name}</span>
                        <span className="text-slate-300">·</span>
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{inq.phone}</span>
                      </div>
                    </td>

                    {/* Material Specification */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800 line-clamp-1 max-w-xs">
                        {inq.product_name}
                      </div>
                      {inq.variant_sku && (
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          SKU: {inq.variant_sku}
                        </span>
                      )}
                    </td>

                    {/* Quantity & Terms */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">
                        {Number(inq.target_quantity).toLocaleString()} {inq.unit}
                      </div>
                      {inq.delivery_term && (
                        <span className="text-[10px] text-slate-500 line-clamp-1 max-w-[150px]">
                          {inq.delivery_term}
                        </span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4">{getStatusBadge(inq.status)}</td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDrawer(inq);
                        }}
                        className="px-3 py-1 bg-white hover:bg-blue-50 text-blue-700 font-semibold text-xs rounded-lg border border-slate-300 hover:border-blue-400 transition"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review & Quotation Slide-Over Drawer */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedInquiry(null)}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col z-10 overflow-y-auto">
            {/* Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-blue-300">
                      {selectedInquiry.reference_number}
                    </span>
                    {getStatusBadge(selectedInquiry.status)}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Received {new Date(selectedInquiry.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
                  title="Copy RFQ summary for WhatsApp/Email"
                >
                  {copySuccess ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedInquiry(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6 flex-1">
              {/* Buyer & Factory Card */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Buyer & Factory Credentials
                </span>
                <div className="space-y-1.5 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-bold text-slate-900 text-sm">
                      {selectedInquiry.company_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{selectedInquiry.full_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                    <a
                      href={`tel:${selectedInquiry.phone}`}
                      className="text-blue-600 font-semibold hover:underline"
                    >
                      {selectedInquiry.phone}
                    </a>
                    <span className="text-slate-300">·</span>
                    <a
                      href={`https://wa.me/${selectedInquiry.phone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 font-semibold hover:underline inline-flex items-center gap-0.5"
                    >
                      WhatsApp <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                    <a
                      href={`mailto:${selectedInquiry.email}?subject=Quotation for ${encodeURIComponent(selectedInquiry.product_name)} [Ref: ${selectedInquiry.reference_number}]`}
                      className="text-blue-600 hover:underline"
                    >
                      {selectedInquiry.email}
                    </a>
                  </div>
                </div>
              </div>

              {/* Material & Target Specs */}
              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 space-y-2.5">
                <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">
                  Requisition Specification
                </span>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {selectedInquiry.product_name}
                  </h4>
                  {selectedInquiry.variant_sku && (
                    <span className="text-xs font-mono text-slate-600">
                      SKU: {selectedInquiry.variant_sku}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Target Quantity</span>
                    <span className="font-bold text-slate-900">
                      {Number(selectedInquiry.target_quantity).toLocaleString()}{' '}
                      {selectedInquiry.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Delivery Destination</span>
                    <span className="font-semibold text-slate-800">
                      {selectedInquiry.delivery_term || 'Factory Door'}
                    </span>
                  </div>
                </div>
                {selectedInquiry.notes && (
                  <div className="pt-2 border-t border-blue-100">
                    <span className="text-[11px] font-semibold text-slate-500 block">
                      Buyer Specifications / Notes:
                    </span>
                    <p className="text-xs text-slate-700 mt-0.5 bg-white p-2.5 rounded-lg border border-blue-100 whitespace-pre-wrap">
                      {selectedInquiry.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Commercial Action & Proforma Pricing Form */}
              <form onSubmit={handleSaveInquiry} className="space-y-4 pt-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Commercial Action & Status Workflow
                </span>

                {saveSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Inquiry record and quotation updated successfully!</span>
                  </div>
                )}

                {/* Status Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Workflow Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) =>
                      setEditStatus(e.target.value as 'new' | 'in_review' | 'quoted' | 'closed')
                    }
                    className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-600"
                  >
                    <option value="new">New Request (Unreviewed)</option>
                    <option value="in_review">In Review (Sourcing / Lab Check)</option>
                    <option value="quoted">Quoted (Proforma Invoice Issued)</option>
                    <option value="closed">Closed / Archived</option>
                  </select>
                </div>

                {/* Quoted Price & Currency */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Quoted Total Amount
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 265000"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-600 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Currency
                    </label>
                    <select
                      value={editCurrency}
                      onChange={(e) => setEditCurrency(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-600"
                    >
                      <option value="BDT">BDT (৳)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </div>

                {/* Admin Sales Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Commercial Sales Notes / Terms Issued
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter proforma quote terms, delivery timeline promised, or mill indent reference..."
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-600 resize-none"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedInquiry(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                  >
                    Close
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save & Update RFQ</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
