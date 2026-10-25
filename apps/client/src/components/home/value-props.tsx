import React from 'react';
import {
  ShieldCheck,
  TrendingDown,
  Truck,
  FileCheck2,
  CheckCircle,
  Building,
} from 'lucide-react';

export function ValueProps() {
  const points = [
    {
      icon: <ShieldCheck className="w-7 h-7 text-blue-600" />,
      title: 'Global Export Compliance',
      description:
        'All yarns, papers, and dyes meet rigorous OEKO-TEX® Standard 100 and ZDHC Level 3 protocols required by major EU and US retail brands.',
      badge: 'Zero-Defect Standard',
    },
    {
      icon: <TrendingDown className="w-7 h-7 text-emerald-600" />,
      title: 'B2B Quantity-Tier Discounts',
      description:
        'Transparent quantity breaks with significant cost savings on container-load and batch lot indent orders directly from certified overseas mills.',
      badge: 'Up to 15% Savings',
    },
    {
      icon: <Truck className="w-7 h-7 text-indigo-600" />,
      title: 'Factory Door Logistics',
      description:
        'Daily logistics fleet providing door-to-door delivery across Gazipur, Narayanganj, Savar, Tongi, and Chattogram EPZ industrial zones.',
      badge: '48h Fleet Dispatch',
    },
    {
      icon: <FileCheck2 className="w-7 h-7 text-purple-600" />,
      title: 'Verified Technical Sheets (TDS)',
      description:
        'Instant technical data sheet downloads, shade cards, and material safety data sheets (MSDS) ready for factory compliance audits.',
      badge: '1-Click PDF Downloads',
    },
  ];

  return (
    <section className="py-14 sm:py-20 bg-slate-900 text-white relative overflow-hidden">
      <div className="container-custom">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-900/40 border border-blue-700/50 text-blue-400 text-xs font-semibold mb-3">
            <Building className="w-3.5 h-3.5" />
            <span>Industrial Trust & Reliability</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Why RMG Manufacturers Partner With Us
          </h2>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Eliminating procurement bottlenecks with transparent commercial terms, verified technical sheets, and reliable logistics across Bangladesh.
          </p>
        </div>

        {/* 4 Value Proposition Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {points.map((p, idx) => (
            <div
              key={idx}
              className="bg-slate-800/80 border border-slate-700/70 rounded-2xl p-6 flex flex-col justify-between hover:border-blue-500/80 hover:bg-slate-800 transition duration-300 shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700/60 flex items-center justify-center">
                    {p.icon}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">
                    {p.badge}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mb-2 leading-snug">
                  {p.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {p.description}
                </p>
              </div>

              <div className="mt-6 pt-3 border-t border-slate-750 flex items-center gap-1.5 text-xs text-blue-400 font-semibold">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Verified Quality</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

