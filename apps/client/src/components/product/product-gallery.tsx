'use client';
import { useState } from 'react';
import type { ImageVariant } from '@/lib/types';
import { CatalogImage } from '@/components/catalog/catalog-image';
import { Package } from 'lucide-react';
export function ProductGallery({
  primaryUrl,
  gallery,
  productName,
  isFeatured,
  isNewArrival,
}: {
  primaryUrl: string | null;
  gallery: ImageVariant[];
  productName: string;
  isFeatured?: boolean;
  isNewArrival?: boolean;
}) {
  const images = [
    ...new Set(
      [primaryUrl, ...gallery.map((image) => image.url)].filter((url): url is string => !!url),
    ),
  ];
  const [index, setIndex] = useState(0);
  const current = images[index] || images[0];
  return (
    <div className="space-y-3">
      <div className="aspect-square bg-slate-100 rounded-2xl border overflow-hidden relative">
        {current ? (
          <CatalogImage
            key={current}
            src={current}
            alt={productName}
            width={2000}
            height={2000}
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority={index === 0}
          />
        ) : (
          <Package className="absolute inset-0 m-auto w-16 h-16 text-slate-400" />
        )}
        {(isFeatured || isNewArrival) && (
          <span className="absolute top-3 left-3 bg-blue-700 text-white px-3 py-1 rounded-full text-xs">
            {isFeatured ? 'Featured' : 'New arrival'}
          </span>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((url, position) => (
            <button
              type="button"
              key={url}
              aria-label={`View image ${position + 1}`}
              aria-pressed={index === position}
              onClick={() => setIndex(position)}
              className="w-20 h-20 shrink-0 rounded-lg border overflow-hidden"
            >
              <CatalogImage
                src={url}
                alt={`${productName} thumbnail ${position + 1}`}
                width={80}
                height={80}
                sizes="80px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
