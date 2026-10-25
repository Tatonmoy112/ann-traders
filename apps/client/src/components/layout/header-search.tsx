'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';

interface HeaderSearchProps {
  className?: string;
  onSearchSubmit?: () => void;
}

export function HeaderSearch({ className = '', onSearchSubmit }: HeaderSearchProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchTerm.trim();
    if (query) {
      router.push(`/products?q=${encodeURIComponent(query)}`);
      onSearchSubmit?.();
    } else {
      router.push('/products');
      onSearchSubmit?.();
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  return (
    <form onSubmit={handleSearch} className={`relative flex items-center ${className}`}>
      <div className="relative w-full">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by yarn count, paper GSM, dye shade, or code..."
          className="w-full pl-9 pr-9 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <Search className="w-4 h-4" />
        </div>
        {searchTerm && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-sm"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <button
        type="submit"
        className="ml-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition shrink-0 hidden sm:inline-flex items-center gap-1 shadow-xs"
      >
        <span>Search</span>
      </button>
    </form>
  );
}

