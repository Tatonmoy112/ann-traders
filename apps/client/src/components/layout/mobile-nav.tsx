'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '@/lib/api';
import { useContactInquiry } from '@/lib/use-contact-inquiry';
import { HeaderSearch } from './header-search';
import { Menu, X, Layers, FileSpreadsheet, ChevronRight, Package } from 'lucide-react';

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const { openInquiry } = useContactInquiry();

  const { data: categories = [] } = useQuery({
    queryKey: ['catalog', 'categories'],
    queryFn: () => catalogApi.getCategories(),
    enabled: isOpen,
    staleTime: 30 * 1000,
  });

  const closeMenu = () => setIsOpen(false);

  const handleOpenInquiry = () => {
    closeMenu();
    openInquiry();
  };

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="p-2 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition"
        aria-label="Open mobile navigation"
      >
        <Menu className="w-6 h-6" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={closeMenu}
          />

          {/* Drawer Panel */}
          <div className="relative w-4/5 max-w-sm bg-white h-full shadow-2xl flex flex-col z-10 overflow-y-auto">
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-sm">
                  ANN
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight">ANN Traders</h3>
                  <p className="text-[10px] text-slate-400">RMG Industrial Supply</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeMenu}
                className="text-slate-400 hover:text-white p-1 rounded-md"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Search */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/60">
              <HeaderSearch onSearchSubmit={closeMenu} />
            </div>

            {/* Quick RFQ Action */}
            <div className="p-4 border-b border-slate-100">
              <button
                type="button"
                onClick={handleOpenInquiry}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition shadow-xs flex items-center justify-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Contact us
              </button>
            </div>

            {/* Navigation Links */}
            <div className="py-2 flex-1">
              <div className="px-4 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Catalog Navigation
              </div>
              <Link
                href="/products"
                onClick={closeMenu}
                className="flex items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-2.5">
                  <Package className="w-4 h-4 text-blue-600" />
                  <span>All Catalog Products</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>

              {/* Categories */}
              <div className="px-4 pt-3 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Sourcing Divisions
              </div>
              <div className="px-2 space-y-0.5">
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/products?category=${encodeURIComponent(cat.slug)}`}
                    onClick={closeMenu}
                    className="flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-700 hover:text-blue-600 hover:bg-blue-50/50 rounded-lg transition"
                  >
                    <span>{cat.name}</span>
                    {cat.product_count !== undefined && cat.product_count > 0 && (
                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-500 font-semibold">
                        {cat.product_count}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>

            <Link
              href="/contact"
              onClick={() => setIsOpen(false)}
              className="block p-4 text-sm text-blue-700"
            >
              Contact ANN Traders
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
