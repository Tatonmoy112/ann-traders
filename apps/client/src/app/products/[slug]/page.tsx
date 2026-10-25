'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '@/lib/api';
import { ProductGallery } from '@/components/product/product-gallery';
import { VolumeTierMatrix } from '@/components/product/volume-tier-matrix';
import { ProductSpecsTable } from '@/components/product/product-specs-table';
import { ProductDocuments } from '@/components/product/product-documents';
import { ProductCard } from '@/components/catalog/product-card';
import { useRfq } from '@/components/rfq/rfq-context';
import type { CatalogVariant, CatalogProduct } from '@/lib/types';
import {
  ChevronRight,
  Package,
  FileSpreadsheet,
  Phone,
  ShieldCheck,
  Truck,
  Layers,
  ArrowRight,
  Loader2,
  CheckCircle2,
  FileText,
  Boxes,
} from 'lucide-react';

export default function ProductDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ? String(params.slug) : '';
  const { openRfq } = useRfq();

  // Active selected variant index
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);

  // Active detail tab
  const [activeTab, setActiveTab] = useState<'specs' | 'description' | 'documents'>('specs');

  // Fetch product detail via Axios SDK
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['catalog', 'product', slug],
    queryFn: () => catalogApi.getProductBySlug(slug),
    enabled: Boolean(slug),
    staleTime: 60 * 1000,
  });

  const product = data?.product;
  const variants = data?.variants || [];
  const documents = data?.documents || [];
  const gallery = data?.gallery || [];

  const activeVariant: CatalogVariant | undefined = variants[selectedVariantIndex] || variants[0];

  // Fetch related products in the same category
  const { data: relatedData } = useQuery({
    queryKey: ['catalog', 'products', 'related', product?.category_slug],
    queryFn: () =>
      catalogApi.getProducts({
        category: product?.category_slug,
        pageSize: 3,
      }),
    enabled: Boolean(product?.category_slug),
    staleTime: 5 * 60 * 1000,
  });

  const relatedProducts = (relatedData?.products || []).filter((p) => p.id !== product?.id);

  if (isLoading) {
    return (
      <div className="container-custom py-24 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-sm font-medium">Loading material specifications...</span>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="container-custom py-20 text-center space-y-4">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
          <Package className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Material Not Found</h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          The requested material specification may have been retired or is currently unavailable.
        </p>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl transition hover:bg-blue-700"
        >
          <span>Return to Catalog</span>
        </Link>
      </div>
    );
  }

  const handleOpenRfq = () => {
    openRfq({
      id: product.id,
      name: product.name,
      sku: activeVariant?.sku || product.product_code,
      unit: activeVariant?.sale_unit || 'KG',
    });
  };

  return (
    <div className="bg-slate-50 min-h-screen py-8 sm:py-12">
      <div className="container-custom space-y-10">
        {/* Breadcrumb Navigation */}
        <nav className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <Link href="/" className="hover:text-blue-600 transition">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <Link href="/products" className="hover:text-blue-600 transition">
            Industrial Catalog
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <Link
            href={`/products?category=${encodeURIComponent(product.category_slug)}`}
            className="hover:text-blue-600 transition font-medium"
          >
            {product.category_name}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-800 font-semibold truncate max-w-[200px] sm:max-w-xs">
            {product.name}
          </span>
        </nav>

        {/* Top Product Hero Grid (Left Gallery + Right Commercial Card) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Image Gallery (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <ProductGallery
              primaryUrl={product.image_url}
              gallery={gallery}
              productName={product.name}
              isFeatured={product.is_featured}
              isNewArrival={product.is_new_arrival}
            />

            {/* Industrial Trust Credentials Box */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Verified Quality & Indenting Guarantee</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>OEKO-TEX® Approved</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>ISO 9001:2015 Sourcing</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Factory Door Fleet Dispatch</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Spot Stock / Foreign L/C</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Commercial Specifications & Actions (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Meta Header */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {product.category_name}
                </span>
                {product.brand_name && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                    {product.brand_name}
                  </span>
                )}
                {product.country_of_origin && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium text-slate-500">
                    Origin: {product.country_of_origin}
                  </span>
                )}
              </div>

              {/* Title & Product Code */}
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                {product.name}
              </h1>
              <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 font-mono">
                <span>Material Code: <strong className="text-slate-800">{product.product_code}</strong></span>
                {activeVariant?.sku && activeVariant.sku !== product.product_code && (
                  <span>· SKU: <strong className="text-blue-700">{activeVariant.sku}</strong></span>
                )}
              </div>
            </div>

            {/* Short Description */}
            {product.short_description && (
              <p className="text-sm text-slate-600 leading-relaxed">
                {product.short_description}
              </p>
            )}

            {/* Variant Selector (if product has multiple variants) */}
            {variants.length > 1 && (
              <div className="space-y-2.5 pt-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Select Grade / Specification Option ({variants.length} available):
                </label>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v, vIdx) => {
                    const isSelected = vIdx === selectedVariantIndex;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariantIndex(vIdx)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition border ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        <span>{v.variant_name}</span>
                        {v.model_number && (
                          <span className={`ml-1 text-[10px] ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
                            ({v.model_number})
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Volume Tier Pricing Component for the active variant */}
            <div className="pt-2">
              <VolumeTierMatrix prices={activeVariant?.prices || []} />
            </div>

            {/* Supply Metrics Summary */}
            {activeVariant && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-100/70 rounded-xl text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Minimum Order (MOQ)</span>
                  <span className="font-bold text-slate-800">
                    {activeVariant.minimum_order_qty} {activeVariant.minimum_order_unit}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Monthly Capacity</span>
                  <span className="font-bold text-slate-800">
                    {activeVariant.monthly_supply_capacity && activeVariant.monthly_supply_capacity !== '0'
                      ? `${Number(activeVariant.monthly_supply_capacity).toLocaleString()} ${activeVariant.capacity_unit}`
                      : 'High Bulk Capacity'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Lead Time / Ready</span>
                  <span className="font-bold text-emerald-700">
                    {activeVariant.lead_time_days === 0
                      ? 'Ready Spot Stock'
                      : `${activeVariant.lead_time_days || '14'} Days`}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons: Request RFQ Quote & Call */}
            <div className="pt-3 flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={handleOpenRfq}
                className="flex-1 py-3.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition shadow-md shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4 text-white" />
                <span>Request B2B Proforma Quotation (RFQ)</span>
              </button>

              <a
                href="tel:+8801711000000"
                className="py-3.5 px-5 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm rounded-xl transition border border-slate-300 flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4 text-emerald-600" />
                <span className="hidden sm:inline">+880 1711-000000</span>
                <span className="sm:hidden">Call</span>
              </a>
            </div>
          </div>
        </div>

        {/* Tabbed Technical & Compliance Information Section */}
        <div className="pt-6 border-t border-slate-200">
          {/* Tab Headers */}
          <div className="flex items-center gap-2 border-b border-slate-200 mb-6">
            <button
              type="button"
              onClick={() => setActiveTab('specs')}
              className={`pb-3 px-4 text-sm font-bold border-b-2 transition ${
                activeTab === 'specs'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Technical Specifications
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('description')}
              className={`pb-3 px-4 text-sm font-bold border-b-2 transition ${
                activeTab === 'description'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Production Applications
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              className={`pb-3 px-4 text-sm font-bold border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'documents'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Compliance & TDS Downloads</span>
              {documents.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700">
                  {documents.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs">
            {activeTab === 'specs' && (
              <ProductSpecsTable product={product} variant={activeVariant} />
            )}

            {activeTab === 'description' && (
              <div className="space-y-4 max-w-3xl">
                <h3 className="text-base font-bold text-slate-900">
                  Material Overview & Industrial Application Notes
                </h3>
                {product.description ? (
                  <div className="text-sm text-slate-600 leading-relaxed space-y-3 whitespace-pre-line">
                    {product.description}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    {product.short_description ||
                      'Standard export-oriented textile and garment manufacturing raw material supplied under strict factory QA supervision.'}
                  </p>
                )}
              </div>
            )}

            {activeTab === 'documents' && <ProductDocuments documents={documents} />}
          </div>
        </div>

        {/* Related Materials Section */}
        {relatedProducts.length > 0 && (
          <div className="pt-10 border-t border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block">
                  Related Materials
                </span>
                <h3 className="text-xl font-black text-slate-900">
                  More From {product.category_name}
                </h3>
              </div>
              <Link
                href={`/products?category=${encodeURIComponent(product.category_slug)}`}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span>View All In Sector</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedProducts.map((rel: CatalogProduct) => (
                <ProductCard key={rel.id} product={rel} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

