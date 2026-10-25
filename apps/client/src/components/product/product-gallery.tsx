'use client';

import React, { useState } from 'react';
import type { ImageVariant } from '@/lib/types';
import { Package, Sparkles } from 'lucide-react';

interface ProductGalleryProps {
  primaryUrl: string | null;
  gallery: ImageVariant[];
  productName: string;
  isFeatured?: boolean;
  isNewArrival?: boolean;
}

export function ProductGallery({
  primaryUrl,
  gallery,
  productName,
  isFeatured,
  isNewArrival,
}: ProductGalleryProps) {
  // Combine primary and gallery, removing duplicates
  const allImages = React.useMemo(() => {
    const urls = new Set<string>();
    const list: { url: string; kind: string }[] = [];

    if (primaryUrl) {
      urls.add(primaryUrl);
      list.push({ url: primaryUrl, kind: 'detail' });
    }

    for (const item of gallery) {
      if (item.url && !urls.has(item.url)) {
        urls.add(item.url);
        list.push({ url: item.url, kind: item.kind });
      }
    }

    return list;
  }, [primaryUrl, gallery]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [imageError, setImageError] = useState(false);

  const currentImage = allImages[selectedIndex]?.url || primaryUrl;

  return (
    <div className="space-y-3.5">
      {/* Main Display Image */}
      <div className="relative aspect-4/3 sm:aspect-square bg-slate-100 rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs">
        {currentImage && !imageError ? (
          <img
            src={currentImage}
            alt={productName}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover transition-all duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 p-6 text-center">
            <Package className="w-16 h-16 stroke-[1.25] text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 mt-3">
              Official Material Image Preview
            </span>
          </div>
        )}

        {/* Status Badges Overlay */}
        <div className="absolute top-3.5 left-3.5 flex flex-wrap gap-1.5 z-10">
          {isFeatured && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500 text-white shadow-xs">
              <Sparkles className="w-3.5 h-3.5" /> Featured Sourcing
            </span>
          )}
          {isNewArrival && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-600 text-white shadow-xs">
              New Arrival
            </span>
          )}
        </div>
      </div>

      {/* Thumbnail Strip (if multiple images available) */}
      {allImages.length > 1 && (
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-0.5">
          {allImages.map((img, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setSelectedIndex(idx);
                  setImageError(false);
                }}
                className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 transition shrink-0 ${
                  isSelected
                    ? 'border-blue-600 ring-2 ring-blue-600/30 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100'
                }`}
              >
                <img
                  src={img.url}
                  alt={`${productName} thumbnail ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

