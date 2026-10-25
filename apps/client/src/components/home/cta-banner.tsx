'use client';

import React from 'react';
import { useRfq } from '@/components/rfq/rfq-context';
import { FileSpreadsheet, Phone, Mail, Building2, CheckCircle2 } from 'lucide-react';

export function CtaBanner() {
  const { openRfq } = useRfq();

  return (
    <section className="py-16 sm:py-24 bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-950 text-white relative overflow-hidden">
      <div className="container-custom relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-700/40 border border-blue-500/40 text-blue-200 text-xs font-semibold backdrop-blur-xs">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span>Industrial Indenting & Foreign L/C Facilitation</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            Planning Container-Load Imports Or Custom Yarn & Paper Runs?
          </h2>

          <p className="text-sm sm:text-base text-blue-100 max-w-2xl mx-auto leading-relaxed">
            From single-container spot purchases to annual contract indenting directly with certified international mills. Our commercial desk coordinates pre-shipment inspections, bill of lading, and Chattogram customs release.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              type="button"
              onClick={() => openRfq()}
              className="px-6 py-3.5 bg-white hover:bg-slate-100 text-blue-900 font-bold text-sm rounded-xl transition shadow-xl inline-flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-700" />
              <span>Submit Sourcing Spec For Quotation</span>
            </button>

            <a
              href="tel:+8801711000000"
              className="px-6 py-3.5 bg-blue-800/80 hover:bg-blue-800 text-white font-semibold text-sm rounded-xl transition border border-blue-600/50 inline-flex items-center gap-2"
            >
              <Phone className="w-4 h-4 text-emerald-400" />
              <span>Call Procurement Desk (+880 1711-000000)</span>
            </a>
          </div>

          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-blue-200">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Direct Mill Pricing</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Foreign L/C / TT Accepted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Pre-Shipment Quality Audits</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

