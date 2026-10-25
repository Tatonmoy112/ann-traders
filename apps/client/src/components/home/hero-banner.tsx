'use client';

import React from 'react';
import Link from 'next/link';
import { useRfq } from '@/components/rfq/rfq-context';
import {
  ShieldCheck,
  ArrowRight,
  FileSpreadsheet,
  CheckCircle2,
  Boxes,
  Truck,
  TrendingDown,
  Layers,
} from 'lucide-react';

export function HeroBanner() {
  const { openRfq } = useRfq();

  const searchShortcuts = [
    { label: '30s/1 Cotton Yarn', query: 'Cotton Yarn' },
    { label: 'CAD Paper 70 GSM', query: 'CAD Marker Paper' },
    { label: 'Levafix Reactive Dyes', query: 'Levafix' },
    { label: 'Underlay Paper', query: 'Underlay' },
    { label: 'Cutting Blades', query: 'Blade' },
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white py-16 sm:py-24 border-b border-slate-800">
      {/* Background Subtle Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b0f_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="container-custom relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Headline & Procurement Pitch (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Top Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-900/40 border border-blue-700/50 text-blue-300 text-xs font-semibold backdrop-blur-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Direct Sourcing & Indenting for Bangladesh RMG Factories</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.1]">
              Industrial RMG Raw Materials <span className="text-blue-400">At Scale.</span>
            </h1>

            {/* Sub-headline */}
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl font-normal">
              Supplying export-standard 100% combed cotton yarns, high-tensile CAD marker papers, OEKO-TEX® certified dyestuffs, and cutting-room equipment spares with factory-gate delivery across Gazipur, Narayanganj, Savar, and Chattogram.
            </p>

            {/* Dual CTAs */}
            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <Link
                href="/products"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-blue-600/30 inline-flex items-center gap-2 group"
              >
                <span>Browse Materials Catalog</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button
                type="button"
                onClick={() => openRfq()}
                className="px-6 py-3 bg-slate-800/90 hover:bg-slate-800 text-slate-100 hover:text-white font-semibold text-sm rounded-xl transition border border-slate-700 inline-flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Request B2B Quote (RFQ)</span>
              </button>
            </div>

            {/* Quick Sourcing Shortcuts */}
            <div className="pt-2">
              <span className="text-xs text-slate-400 font-medium mr-2">Quick Inquiries:</span>
              <div className="inline-flex flex-wrap gap-1.5 mt-1 sm:mt-0">
                {searchShortcuts.map((s) => (
                  <Link
                    key={s.label}
                    href={`/products?q=${encodeURIComponent(s.query)}`}
                    className="text-xs bg-slate-800/60 hover:bg-blue-900/40 text-slate-300 hover:text-blue-300 px-2.5 py-1 rounded-md border border-slate-700/60 transition"
                  >
                    {s.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Industrial Card Hero Metric Showcase (5 Cols) */}
          <div className="lg:col-span-5">
            <div className="relative mx-auto max-w-md lg:max-w-none bg-slate-850/90 border border-slate-700/80 rounded-3xl p-6 sm:p-7 shadow-2xl backdrop-blur-md space-y-5">
              {/* Card Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">Commercial Indent Desk</h3>
                    <p className="text-[11px] text-slate-400">Ready Stock & Contract Indenting</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-full flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Sourcing
                </span>
              </div>

              {/* Live Metric Rows */}
              <div className="space-y-3">
                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center text-blue-400">
                      <TrendingDown className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">Volume Tier Pricing</div>
                      <div className="text-[11px] text-slate-400">Quantity breaks up to 15% discount</div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">Tier Matrix</span>
                </div>

                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600/20 flex items-center justify-center text-emerald-400">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">Direct Factory Delivery</div>
                      <div className="text-[11px] text-slate-400">Fleet coverage: Dhaka, Gazipur & Narayanganj</div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-blue-400">48-Hour</span>
                </div>

                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center text-purple-400">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">Verified TDS / MSDS</div>
                      <div className="text-[11px] text-slate-400">Download technical compliance sheets</div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-purple-400">PDF Ready</span>
                </div>
              </div>

              {/* Card Footer Quote Requisition Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => openRfq()}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-md flex items-center justify-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Submit Spec for Proforma Invoice</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Key Metric Stats Strip */}
        <div className="mt-16 pt-10 border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white">12+ Years</div>
            <div className="text-xs text-slate-400 mt-1">RMG Supply Experience</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white">500+</div>
            <div className="text-xs text-slate-400 mt-1">Garment Factory Clients</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400">100%</div>
            <div className="text-xs text-slate-400 mt-1">OEKO-TEX / ISO Quality</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-blue-400">48h Door</div>
            <div className="text-xs text-slate-400 mt-1">Gazipur & Narayanganj Logistics</div>
          </div>
        </div>
      </div>
    </section>
  );
}

