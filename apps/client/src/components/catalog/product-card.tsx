import Link from 'next/link';
import { Package, ArrowRight } from 'lucide-react';
import type { CatalogProduct } from '@/lib/types';
import { priceLabel } from '@/lib/catalog-contract';
import { CatalogImage } from './catalog-image';

export function ProductCard({ product }: { product: CatalogProduct }) {
  return (
    <article className="group bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
      <Link href={`/products/${product.slug}`} className="block aspect-4/3 bg-slate-100 relative">
        {product.image_url ? (
          <CatalogImage
            src={product.image_url}
            alt={product.name}
            width={768}
            height={576}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <Package className="w-12 h-12 absolute inset-0 m-auto text-slate-400" />
        )}
      </Link>
      <div className="p-5 flex-1 flex flex-col gap-3">
        <p className="text-xs text-blue-700">
          {product.category_name}
          {product.brand_name ? ` - ${product.brand_name}` : ''}
        </p>
        <h3 className="font-bold">
          <Link href={`/products/${product.slug}`}>{product.name}</Link>
        </h3>
        <p className="text-xs text-slate-500">{product.product_code}</p>
        {product.short_description && (
          <p className="text-sm text-slate-600 line-clamp-2">{product.short_description}</p>
        )}
        <p className="font-semibold text-emerald-800">{priceLabel(product.display_price)}</p>
        {product.display_price?.trade_term && (
          <p className="text-xs">{product.display_price.trade_term}</p>
        )}
        <div className="flex items-center justify-between mt-auto pt-3 border-t text-sm">
          <Link href={`/products/${product.slug}`} className="inline-flex items-center gap-1">
            View specifications <ArrowRight size={14} />
          </Link>
          <Link
            href={`/contact?product=${encodeURIComponent(product.product_code)}`}
            className="text-blue-700"
          >
            Contact
          </Link>
        </div>
      </div>
    </article>
  );
}
