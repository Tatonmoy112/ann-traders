'use client';

import React, { useState, useEffect } from 'react';
import { useRfq } from './rfq-context';
import { catalogApi, type InquiryInput } from '@/lib/api';
import { X, CheckCircle2, AlertCircle, Loader2, Send, Building, Phone, Mail, User, Package, FileSpreadsheet } from 'lucide-react';

export function RfqModal() {
  const { isOpen, targetProduct, closeRfq } = useRfq();

  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [productName, setProductName] = useState('');
  const [variantSku, setVariantSku] = useState('');
  const [targetQuantity, setTargetQuantity] = useState('100');
  const [unit, setUnit] = useState('KG');
  const [deliveryTerm, setDeliveryTerm] = useState('Delivered to Factory (Gazipur / Narayanganj)');
  const [notes, setNotes] = useState('');
  const [faxNumber, setFaxNumber] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    referenceNumber: string;
    message: string;
  } | null>(null);

  // Sync target product whenever modal opens
  useEffect(() => {
    if (targetProduct) {
      setProductName(targetProduct.name);
      setVariantSku(targetProduct.sku || '');
      setUnit(targetProduct.unit || 'KG');
    } else {
      setProductName('General RMG Materials Inquiry');
      setVariantSku('');
      setUnit('KG');
    }
    setError(null);
    setSuccessResult(null);
  }, [targetProduct, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const payload: InquiryInput = {
        fullName: fullName.trim(),
        companyName: companyName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        productId: targetProduct?.id || 'd1a04e00-fb50-42de-8428-b9c956bf971e', // fallback sample UUID if general
        productName: productName.trim(),
        variantSku: variantSku.trim() || undefined,
        targetQuantity: Math.max(1, Number(targetQuantity) || 1),
        unit: unit.trim(),
        deliveryTerm: deliveryTerm.trim() || undefined,
        notes: notes.trim() || undefined,
        faxNumber: faxNumber.trim() || undefined,
      };

      const res = await catalogApi.submitInquiry(payload);
      setSuccessResult({
        referenceNumber: res.referenceNumber,
        message: res.message,
      });
    } catch (err) {
      console.error('Failed to submit quote request:', err);
      setError((err as Error).message || 'Failed to submit quote request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/30 flex items-center justify-center text-blue-400 border border-blue-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Request Commercial Quotation (RFQ)</h2>
              <p className="text-xs text-slate-400">Direct factory supply & indenting quotation with volume tier pricing</p>
            </div>
          </div>
          <button
            onClick={closeRfq}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {successResult ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Quotation Request Submitted!</h3>
              <div className="inline-block bg-slate-100 border border-slate-200 px-4 py-2 rounded-lg font-mono text-sm font-semibold text-blue-700">
                Tracking Ref: {successResult.referenceNumber}
              </div>
              <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                {successResult.message}
              </p>
              <div className="pt-4">
                <button
                  onClick={closeRfq}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-lg transition"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Anti-bot honeypot field - invisible to humans */}
              <div
                style={{
                  position: 'absolute',
                  opacity: 0,
                  zIndex: -1,
                  pointerEvents: 'none',
                  height: 0,
                  overflow: 'hidden',
                }}
                aria-hidden="true"
              >
                <label htmlFor="rfq-fax-field">Fax Number</label>
                <input
                  id="rfq-fax-field"
                  type="text"
                  name="fax_number"
                  tabIndex={-1}
                  autoComplete="off"
                  value={faxNumber}
                  onChange={(e) => setFaxNumber(e.target.value)}
                />
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Product Info Banner */}
              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Package className="w-5 h-5 text-blue-600 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-blue-900 uppercase tracking-wide">Target Material:</span>
                    <p className="text-sm font-bold text-slate-900">{productName}</p>
                    {variantSku && <p className="text-xs text-slate-500 font-mono">SKU: {variantSku}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 bg-white border border-blue-200 text-blue-700 text-xs font-medium rounded-md">
                    B2B Indent / Spot
                  </span>
                </div>
              </div>

              {/* Grid 1: Contact Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" /> Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Md. Tariqul Islam"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-slate-400" /> Factory / Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Spinning & Knitting Ltd."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Grid 2: Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> Business Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="procurement@factory.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> Mobile / WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+880 171X-XXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Grid 3: Quantity & Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Target Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={targetQuantity}
                    onChange={(e) => setTargetQuantity(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Unit
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="KG">Kilograms (KG)</option>
                    <option value="Tons">Metric Tons</option>
                    <option value="Rolls">Rolls</option>
                    <option value="Bales">Bales</option>
                    <option value="Yards">Yards</option>
                    <option value="Meters">Meters</option>
                    <option value="PCS">Pieces (PCS)</option>
                  </select>
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Delivery Term
                  </label>
                  <select
                    value={deliveryTerm}
                    onChange={(e) => setDeliveryTerm(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="Delivered Gazipur / Narayanganj">Delivered Gazipur / Narayanganj</option>
                    <option value="Ex-Warehouse Dhaka">Ex-Warehouse Dhaka</option>
                    <option value="Chattogram Port CIF / L/C">Chattogram Port CIF / L/C</option>
                    <option value="Ex-Factory Direct">Ex-Factory Direct</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Additional Technical Specifications / Grade Requirements
                </label>
                <textarea
                  rows={3}
                  placeholder="Mention desired yarn count, paper GSM, shade codes, certifications (OEKO-TEX / GOTS), or delivery timeline..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeRfq}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition flex items-center gap-2 shadow-sm"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting RFQ...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Quotation Request
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

