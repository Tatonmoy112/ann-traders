'use client';
import Image from 'next/image';
import { useState } from 'react';
import { Package } from 'lucide-react';
export function CatalogImage({
  src,
  alt,
  width,
  height,
  sizes,
  priority = false,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <div
        className="w-full h-full flex items-center justify-center text-slate-400"
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
      width={width}
      height={height}
      sizes={sizes}
      preload={priority}
      loading={priority ? undefined : 'lazy'}
      onError={() => setFailed(true)}
      className="w-full h-full object-cover"
    />
  );
}
