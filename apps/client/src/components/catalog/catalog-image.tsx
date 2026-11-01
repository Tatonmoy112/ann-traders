'use client';
import Image from 'next/image';
import { useState } from 'react';
import { Package } from 'lucide-react';
export function CatalogImage({
  src,
  alt,
  sizes,
  priority = false,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <div
        className="absolute inset-0 flex items-center justify-center text-slate-400"
        role="img"
        aria-label="Image unavailable"
      >
        <Package size={40} />
      </div>
    );
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      preload={priority}
      loading={priority ? undefined : 'lazy'}
      onError={() => setFailed(true)}
      className="w-full h-full object-cover"
    />
  );
}
