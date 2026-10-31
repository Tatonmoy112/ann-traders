'use client';

import React from 'react';
import { Search, X, SlidersHorizontal, ArrowUpDown } from 'lucide-react';

interface CatalogToolbarProps {
  total: number;
  searchQuery: string;
  sortValue: string;
  onSearchChange: (query: string) => void;
  onSortChange: (sort: string) => void;
  onOpenMobileFilters: () => void;
  activeFilterCount: number;
  activeTags: { label: string; onRemove: () => void }[];
  onClearAll: () => void;
}

export function CatalogToolbar({
  total,
  searchQuery,
  sortValue,
  onSearchChange,
  onSortChange,
  onOpenMobileFilters,
  activeFilterCount,
  activeTags,
  onClearAll,
}: CatalogToolbarProps) {
  return (
    <div className="space-y-3 mb-6">
      {/* Top Controls Row */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Left: Total Count & Mobile Filter Toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileFilters}
            className="lg:hidden px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5 border border-slate-200"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          <div className="text-xs sm:text-sm font-semibold text-slate-700">
            <span>{total === 1 ? '1 Material Found' : `${total} Materials Found`}</span>
          </div>
        </div>

        {/* Right: Search Input & Sort Selector */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-1 sm:flex-initial justify-end">
          {/* Quick Filter Keyword Input */}
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Filter by keyword..."
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="relative shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden sm:inline" />
              <select
                value={sortValue}
                onChange={(e) => onSortChange(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-600"
              >
                <option value="updated_at_desc">Recently Updated</option>
                <option value="published_at_desc">Newest Published</option>
                <option value="name_asc">Name: A to Z</option>
                <option value="name_desc">Name: Z to A</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Active Filter Tags Row (if any active) */}
      {activeTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-slate-400 font-medium">Active Filters:</span>
          {activeTags.map((tag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium"
            >
              <span>{tag.label}</span>
              <button
                type="button"
                onClick={tag.onRemove}
                className="p-0.5 hover:bg-blue-200 rounded-full transition"
                aria-label="Remove filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          <button
            type="button"
            onClick={onClearAll}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline ml-1"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
