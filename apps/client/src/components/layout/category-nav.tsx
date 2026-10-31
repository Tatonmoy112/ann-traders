'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '@/lib/api';
import type { CatalogCategory } from '@/lib/types';
import { LayoutGrid, ChevronDown, ArrowRight, Layers, Sparkles, Loader2 } from 'lucide-react';

export function CategoryNav() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['catalog', 'categories', 'tree'],
    queryFn: () => catalogApi.getCategories({ tree: true }),
    enabled: isOpen,
    staleTime: 30 * 1000,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-800 hover:text-blue-600 bg-slate-100/80 hover:bg-slate-100 rounded-lg transition border border-slate-200/80"
        aria-expanded={isOpen}
      >
        <LayoutGrid className="w-4 h-4 text-blue-600" />
        <span>Material Sectors</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-1">
          <div className="p-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" /> Sourcing Divisions
            </span>
            <Link
              href="/products"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              All Products <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="py-2 max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {isLoading ? (
              <div className="p-6 text-center text-slate-400 flex items-center justify-center gap-2 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> Loading categories...
              </div>
            ) : categories.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                No active categories found.
              </div>
            ) : (
              categories.map((cat: CatalogCategory) => (
                <div key={cat.id} className="p-1.5">
                  <Link
                    href={`/products?category=${encodeURIComponent(cat.slug)}`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-700 hover:text-blue-600 hover:bg-blue-50/60 rounded-lg transition group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500/50 group-hover:bg-blue-600 transition" />
                      <span>{cat.name}</span>
                    </div>
                    {cat.product_count !== undefined && cat.product_count > 0 ? (
                      <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 group-hover:bg-blue-100 text-slate-600 group-hover:text-blue-700 rounded-full transition">
                        {cat.product_count}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 group-hover:text-blue-600">→</span>
                    )}
                  </Link>

                  {/* Render nested children if present */}
                  {cat.children && cat.children.length > 0 && (
                    <div className="pl-6 pr-2 py-1 space-y-0.5 bg-slate-50/50 rounded-md my-0.5">
                      {cat.children.map((sub) => (
                        <Link
                          key={sub.id}
                          href={`/products?category=${encodeURIComponent(sub.slug)}`}
                          onClick={() => setIsOpen(false)}
                          className="flex items-center justify-between px-2 py-1 text-xs text-slate-600 hover:text-blue-600 rounded transition"
                        >
                          <span>{sub.name}</span>
                          {sub.product_count !== undefined && sub.product_count > 0 && (
                            <span className="text-[10px] text-slate-400">{sub.product_count}</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
            <Link
              href="/products?featured=true"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              View Featured Factory High-Demand Items
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
