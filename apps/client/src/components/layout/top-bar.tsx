import React from 'react';
import { Phone, Mail, MapPin, ShieldCheck } from 'lucide-react';

export function TopBar() {
  return (
    <div className="bg-slate-900 text-slate-300 text-xs border-b border-slate-800">
      <div className="container-custom py-2 flex flex-wrap items-center justify-between gap-2">
        {/* Left: Certifications & Sourcing Scope */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-blue-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>ISO 9001:2015 & OEKO-TEX® Certified RMG Supply</span>
          </div>
          <span className="hidden md:inline text-slate-600">|</span>
          <div className="hidden md:flex items-center gap-1 text-slate-400">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span>Hubs: Dhaka · Narayanganj · Chattogram Port</span>
          </div>
        </div>

        {/* Right: Commercial Hotlines */}
        <div className="flex items-center gap-4 ml-auto">
          <a
            href="tel:+8801711000000"
            className="flex items-center gap-1.5 hover:text-white transition"
          >
            <Phone className="w-3 h-3 text-emerald-400" />
            <span>Hotline: <strong className="text-white">+880 1711-000000</strong></span>
          </a>
          <span className="hidden sm:inline text-slate-600">|</span>
          <a
            href="mailto:commercial@anntraders.com"
            className="hidden sm:flex items-center gap-1.5 hover:text-white transition"
          >
            <Mail className="w-3 h-3 text-slate-400" />
            <span>commercial@anntraders.com</span>
          </a>
          <span className="hidden lg:inline text-slate-600">|</span>
          <div className="hidden lg:flex items-center gap-1.5 text-amber-400 font-mono text-[11px]">
            <span>BDT (৳) B2B Indent / Spot</span>
          </div>
        </div>
      </div>
    </div>
  );
}

