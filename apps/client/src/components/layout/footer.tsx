import React from 'react';
import Link from 'next/link';
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  ShieldCheck,
  FileText,
  Truck,
  Building2,
  ExternalLink,
  Award,
} from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-300 border-t border-slate-800">
      {/* Top Value Proposition Grid */}
      <div className="border-b border-slate-800/80 bg-slate-900/60">
        <div className="container-custom py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight">Oeko-Tex & ISO Certified</h4>
                <p className="text-xs text-slate-400 mt-0.5">Strict compliance with European chemical & textile export standards.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight">Direct Factory Door Logistics</h4>
                <p className="text-xs text-slate-400 mt-0.5">Prompt deliveries to Gazipur, Narayanganj, Savar, and Chattogram EPZ.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight">B2B Volume Tier Pricing</h4>
                <p className="text-xs text-slate-400 mt-0.5">Competitive factory-gate rates for container-load and spot lot orders.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight">Technical Data Sheets (TDS)</h4>
                <p className="text-xs text-slate-400 mt-0.5">Downloadable lab test certificates, MSDS, and specification sheets.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main 4-Column Footer */}
      <div className="container-custom py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Column 1: Corporate Profile (Spans 2 columns on LG) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-extrabold text-base tracking-wider shadow-sm">
                ANN
              </div>
              <div>
                <span className="text-lg font-black tracking-tight text-white block">
                  ANN TRADERS
                </span>
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                  Industrial RMG & Textile Supply Partner
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Established in 2012, ANN Traders is a premier importer, indentor, and stockist of high-grade knitting yarns, CAD/CAM apparel papers, eco-certified textile dyes, and industrial machinery spare parts across Bangladesh.
            </p>

            <div className="pt-2 text-xs text-slate-400 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-slate-300 font-medium">Registered Indentor & Importer</span>
              </div>
              <p className="text-[11px] text-slate-500">Government of Bangladesh Trade License & BIN Registered</p>
            </div>
          </div>

          {/* Column 2: Sourcing Categories */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Sourcing Sectors
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/products?category=fabrics-textiles"
                  className="hover:text-blue-400 transition"
                >
                  Fabrics & Yarns
                </Link>
              </li>
              <li>
                <Link
                  href="/products?category=garments-cad-cam"
                  className="hover:text-blue-400 transition"
                >
                  CAD/CAM Cutting Room Paper
                </Link>
              </li>
              <li>
                <Link
                  href="/products?category=dyes-chemicals-inks"
                  className="hover:text-blue-400 transition"
                >
                  Textile Dyes & Auxiliaries
                </Link>
              </li>
              <li>
                <Link
                  href="/products?category=industrial-machinery"
                  className="hover:text-blue-400 transition"
                >
                  Machinery Parts & Blades
                </Link>
              </li>
              <li>
                <Link
                  href="/products?category=packaging-accessories"
                  className="hover:text-blue-400 transition"
                >
                  Export Packaging & Trims
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Commercial & Indenting */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              B2B Services
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/products" className="hover:text-blue-400 transition">
                  Browse Full Catalog
                </Link>
              </li>
              <li>
                <Link href="/documents" className="hover:text-blue-400 transition">
                  Technical Compliance & TDS
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-blue-400 transition">
                  Commercial Hubs & Contact
                </Link>
              </li>
              <li>
                <span className="text-slate-400 cursor-default">
                  Foreign L/C Indenting Services
                </span>
              </li>
              <li>
                <span className="text-slate-400 cursor-default">
                  Custom Paper Slitting & Re-reeling
                </span>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact & Hubs */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Corporate Office & Hubs
            </h4>
            <div className="space-y-2.5 text-xs text-slate-400">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                <span>Sector 3, Uttara Model Town, Dhaka-1230, Bangladesh</span>
              </div>
              <div className="flex items-start gap-2">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>Agrabad C/A, Chattogram (Port Liaison)</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <a href="tel:+8801711000000" className="hover:text-white transition">
                  +880 1711-000000 / +880 2-8900000
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <a href="mailto:commercial@anntraders.com" className="hover:text-white transition">
                  commercial@anntraders.com
                </a>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>Sat – Thu: 9:00 AM – 7:00 PM BST</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Copyright Bar */}
      <div className="border-t border-slate-900 bg-slate-950 py-6 text-xs text-slate-500">
        <div className="container-custom flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 ANN Traders Ltd. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <span>Privacy Policy</span>
            <span>·</span>
            <span>Terms of Supply & Indenting</span>
            <span>·</span>
            <span>Quality Assurance</span>
            <span>·</span>
            <span className="text-slate-400">Made for Bangladesh RMG Excellence</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

