'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { catalogApi, type InquiryInput } from '@/lib/api';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Clock,
  Truck,
  ShieldCheck,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Boxes,
} from 'lucide-react';

export default function ContactPage() {
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [productName, setProductName] = useState('');
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
        productId: 'd1a04e00-fb50-42de-8428-b9c956bf971e', // General inquiry product ID
        productName: productName.trim() || 'General Commercial RMG Sourcing',
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
      console.error('Failed to submit quote inquiry:', err);
      setError((err as Error).message || 'Failed to submit inquiry. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen py-8 sm:py-12">
      <div className="container-custom space-y-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/" className="hover:text-blue-600 transition">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-800 font-semibold">
            Commercial Sourcing & Hubs
          </span>
        </nav>

        {/* Page Header */}
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
            <Building2 className="w-4 h-4" />
            <span>Commercial Headquarters & Logistics</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Commercial Desk & Factory Delivery Hubs
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Coordinating direct mill indenting, foreign letters of credit (L/C), customs clearance through Chattogram Port, and factory door fleet logistics.
          </p>
        </div>

        {/* 3 Regional Hub Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Corporate HQ */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                Corporate Headquarters
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">Dhaka Commercial Office</h3>
            </div>
            <div className="space-y-2 text-xs text-slate-600 pt-1">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>Sector 3, Uttara Model Town, Dhaka-1230, Bangladesh</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>+880 1711-000000 / +880 2-8900000</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                <span>commercial@anntraders.com</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500 text-[11px] pt-1">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>Sat – Thu: 9:00 AM – 7:00 PM BST</span>
              </div>
            </div>
          </div>

          {/* Chattogram Port Liaison */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                Port Indenting & Customs
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">Chattogram Liaison Depot</h3>
            </div>
            <div className="space-y-2 text-xs text-slate-600 pt-1">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>Agrabad Commercial Area, Chattogram Port City</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>+880 31-720000 (Port Desk)</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>chattogram@anntraders.com</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500 text-[11px] pt-1">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Pre-Shipment Inspection & C&F Handling</span>
              </div>
            </div>
          </div>

          {/* Factory Fleet Hubs */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                Scheduled Logistics Fleet
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">Direct Factory Fleet Hubs</h3>
            </div>
            <div className="space-y-2 text-xs text-slate-600 pt-1">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Hub 1: Tongi / Gazipur Industrial Zone</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Hub 2: Fatullah / Kanchpur, Narayanganj</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Hub 3: Savar & Ashulia Apparel Belt</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-700 font-medium text-[11px] pt-1">
                <Truck className="w-3.5 h-3.5 shrink-0" />
                <span>Daily 24h–48h Scheduled Dispatches</span>
              </div>
            </div>
          </div>
        </div>

        {/* Direct In-Page RFQ Quotation Form */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-10">
          <div className="max-w-2xl">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block">
              Commercial Requisition
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              Request A Formal Proforma Invoice Or Sample Lot
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Submit your yarn count, paper GSM, dye shade code, or foreign L/C indenting specifications. Our commercial department will issue a formal quote within 4 business hours.
            </p>
          </div>

          <div className="mt-8 max-w-2xl">
            {successResult ? (
              <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Quotation Request Received</h3>
                <div className="inline-block bg-white border border-emerald-300 px-3 py-1 rounded-lg font-mono text-xs font-bold text-emerald-700">
                  Tracking ID: {successResult.referenceNumber}
                </div>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  {successResult.message}
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setSuccessResult(null)}
                    className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg"
                  >
                    Submit Another Inquiry
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
                  <label htmlFor="contact-fax-field">Fax Number</label>
                  <input
                    id="contact-fax-field"
                    type="text"
                    name="fax_number"
                    tabIndex={-1}
                    autoComplete="off"
                    value={faxNumber}
                    onChange={(e) => setFaxNumber(e.target.value)}
                  />
                </div>

                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Md. Tariqul Islam"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-hidden focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Factory / Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Spinning & Garments Ltd."
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-hidden focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Business Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="procurement@factory.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-hidden focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mobile / WhatsApp Number *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+880 171X-XXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-hidden focus:border-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Material Specification / Requirement *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 100% Combed Cotton Yarn 30s/1, or 70 GSM CAD Paper"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-hidden focus:border-blue-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Target Quantity *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={targetQuantity}
                      onChange={(e) => setTargetQuantity(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-hidden focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Unit
                    </label>
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-hidden focus:border-blue-600"
                    >
                      <option value="KG">Kilograms (KG)</option>
                      <option value="Tons">Metric Tons</option>
                      <option value="Rolls">Rolls</option>
                      <option value="Bales">Bales</option>
                      <option value="Yards">Yards</option>
                      <option value="Meters">Meters</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Delivery Destination
                    </label>
                    <select
                      value={deliveryTerm}
                      onChange={(e) => setDeliveryTerm(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-hidden focus:border-blue-600"
                    >
                      <option value="Delivered Gazipur / Narayanganj">Delivered Gazipur / Narayanganj</option>
                      <option value="Ex-Warehouse Dhaka">Ex-Warehouse Dhaka</option>
                      <option value="Chattogram Port CIF / L/C">Chattogram Port CIF / L/C</option>
                      <option value="Ex-Factory Direct">Ex-Factory Direct</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Additional Specifications & Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Mention desired yarn count, roll width, shade codes, or required certifications (OEKO-TEX / GOTS)..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-hidden focus:border-blue-600 resize-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-xs"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting Requisition...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Submit Formal RFQ Quotation
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

