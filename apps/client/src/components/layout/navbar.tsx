'use client';

import React from 'react';
import Link from 'next/link';
import { CategoryNav } from './category-nav';
import { HeaderSearch } from './header-search';
import { MobileNav } from './mobile-nav';
import { useContactInquiry } from '@/lib/use-contact-inquiry';
import { FileSpreadsheet, Box } from 'lucide-react';

export function Navbar() {
  const { openInquiry } = useContactInquiry();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="container-custom">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-3 sm:gap-6">
          {/* Left: Mobile Nav & Brand Logo */}
          <div className="flex items-center gap-3">
            <MobileNav />

            <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group shrink-0">
              {/* Corporate Industrial Icon / Monogram */}
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-950 flex items-center justify-center text-white font-extrabold text-sm sm:text-base tracking-wider shadow-sm border border-blue-700/30 group-hover:shadow-md transition">
                ANN
              </div>
              <div className="flex flex-col">
                <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 group-hover:text-blue-700 transition leading-tight">
                  ANN TRADERS
                </span>
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 tracking-wide uppercase leading-tight">
                  RMG Industrial Supply
                </span>
              </div>
            </Link>
          </div>

          {/* Center: Category Dropdown & Search Bar (Desktop / Tablet) */}
          <div className="hidden lg:flex items-center gap-3 flex-1 max-w-2xl mx-4">
            <CategoryNav />
            <div className="flex-1">
              <HeaderSearch />
            </div>
          </div>

          {/* Right: Quick Links & RFQ Action */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {/* Quick Links on Tablet/Desktop */}
            <nav className="hidden xl:flex items-center gap-5 text-sm font-semibold text-slate-700">
              <Link
                href="/products"
                className="hover:text-blue-600 transition flex items-center gap-1.5"
              >
                <Box className="w-4 h-4 text-slate-400" />
                <span>Products</span>
              </Link>
              <Link
                href="/documents"
                className="hover:text-blue-600 transition flex items-center gap-1.5"
              >
                <span>Compliance TDS</span>
              </Link>
              <Link
                href="/contact"
                className="hover:text-blue-600 transition flex items-center gap-1.5"
              >
                <span>Contact Hubs</span>
              </Link>
            </nav>

            {/* Contact us Button */}
            <button
              type="button"
              onClick={() => openInquiry()}
              className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] rounded-xl shadow-xs transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Contact us</span>
              <span className="sm:hidden">Contact</span>
            </button>
          </div>
        </div>

        {/* Search Bar for Mobile screens below LG */}
        <div className="lg:hidden pb-3 pt-1">
          <HeaderSearch />
        </div>
      </div>
    </header>
  );
}
