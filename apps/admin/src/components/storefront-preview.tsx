'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Package,
  CheckCircle2,
  Clock,
  Truck,
  ShieldCheck,
  Grid,
  FileText,
  Building2,
  ExternalLink,
  Download,
} from 'lucide-react';
import type { Product } from '@ann/database';
import { formatPrice } from '@ann/domain';
import { api } from '@/lib/client';
import { Badge, Button } from '@ann/ui';

type Variant = {
  id?: string;
  sku: string;
  variant_name: string;
  base_unit_id: string | null;
  minimum_order_qty?: string | number | null;
  minimum_order_unit_id?: string | null;
  monthly_supply_capacity?: string | number | null;
  capacity_unit_id?: string | null;
  lead_time_days?: number | null;
  availability_status: string;
  is_default: boolean;
  is_active: boolean;
};

type Price = {
  id?: string;
  variant_id: string;
  currency_code: string;
  price_type: string;
  min_price: string | number | null;
  max_price: string | number | null;
  price_unit_id: string | null;
  trade_term?: string | null;
  is_active: boolean;
};

type Assets = {
  images: {
    id: string;
    delivery_url: string | null;
    upload_status: string;
    is_primary: boolean;
    alt_text: string | null;
    object_manifest?: { kind: string; url: string; width: number }[];
  }[];
  documents?: {
    id: string;
    title: string;
    document_type: string;
    is_public: boolean;
    bytes?: number | null;
  }[];
};

export function StorefrontPreview({
  id,
  product,
  variants,
  prices,
}: {
  id: string;
  product: Product;
  variants: Variant[];
  prices: Price[];
}) {
  const [viewMode, setViewMode] = useState<'card' | 'detail'>('card');
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(() => {
    const defaultIdx = variants.findIndex((v) => v.is_default && v.is_active);
    return defaultIdx >= 0 ? defaultIdx : 0;
  });

  // 1. Fetch images
  const { data: assets } = useQuery({
    queryKey: ['assets', id],
    queryFn: () => api<Assets>(`/api/admin/products/${id}/assets`),
  });

  // 2. Fetch lookups for Category, Brand, Units
  const { data: categories } = useQuery({
    queryKey: ['lookup', 'categories'],
    queryFn: () =>
      api<{ rows: { id: string; name: string }[] }>('/api/admin/masters/categories?lookup=true'),
  });

  const { data: brands } = useQuery({
    queryKey: ['lookup', 'brands'],
    queryFn: () =>
      api<{ rows: { id: string; name: string; country_code?: string; logo_path?: string }[] }>(
        '/api/admin/masters/brands?lookup=true',
      ),
  });

  const { data: units } = useQuery({
    queryKey: ['lookup', 'units'],
    queryFn: () =>
      api<{ rows: { id: string; symbol: string; code: string; name: string }[] }>(
        '/api/admin/masters/units?lookup=true',
      ),
  });

  const { data: priceTiers } = useQuery({
    queryKey: ['relation', id, 'price_tiers'],
    queryFn: () =>
      api<
        {
          id: string;
          variant_price_id: string;
          min_quantity: string | number;
          max_quantity: string | number | null;
          quantity_unit_id: string;
          unit_price: string | number;
          sort_order?: number;
        }[]
      >(`/api/admin/products/${id}/relations/price_tiers`),
  });

  const categoryName =
    categories?.rows.find((c) => c.id === product.primary_category_id)?.name ?? 'General Category';

  const brand = brands?.rows.find((b) => b.id === product.brand_id);

  const activeVariants = variants.filter((v) => v.is_active);
  const currentVariant = activeVariants[selectedVariantIndex] ?? activeVariants[0] ?? variants[0];

  const currentPrice = prices.find((p) => p.is_active && p.variant_id === currentVariant?.id);

  const currentTiers = (priceTiers ?? [])
    .filter((t) => t.variant_price_id === currentPrice?.id)
    .sort((a, b) => Number(a.min_quantity) - Number(b.min_quantity));

  const priceUnit = units?.rows.find((u) => u.id === currentPrice?.price_unit_id);
  const saleUnit = units?.rows.find((u) => u.id === currentVariant?.base_unit_id);

  const primaryImage =
    assets?.images.find((img) => img.is_primary && img.upload_status === 'ready') ??
    assets?.images.find((img) => img.upload_status === 'ready');

  const imageUrl =
    primaryImage?.object_manifest?.find((m) => m.kind === 'card')?.url ??
    primaryImage?.delivery_url ??
    null;

  const availabilityLabel = (status: string) => {
    switch (status) {
      case 'in_stock':
        return 'In Stock';
      case 'made_to_order':
        return 'Made to Order';
      case 'pre_order':
        return 'Pre-Order';
      case 'on_request':
        return 'On Request';
      case 'out_of_stock':
        return 'Out of Stock';
      default:
        return status;
    }
  };

  return (
    <div className="storefront-preview-container" style={{ margin: '1.5rem 0' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div>
          <span className="eyebrow" style={{ color: '#2563eb' }}>
            STOREFRONT SIMULATION
          </span>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
            What customers will see in the catalog
          </h3>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className={`btn ${viewMode === 'card' ? 'btn-primary' : 'btn-outline'}`}
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
            onClick={() => setViewMode('card')}
          >
            <Grid size={14} style={{ marginRight: 4 }} />
            Catalog Card
          </button>
          <button
            type="button"
            className={`btn ${viewMode === 'detail' ? 'btn-primary' : 'btn-outline'}`}
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
            onClick={() => setViewMode('detail')}
          >
            <FileText size={14} style={{ marginRight: 4 }} />
            Detail Page Hero
          </button>
        </div>
      </div>

      {viewMode === 'card' ? (
        /* ================= 1. CATALOG CARD VIEW ================= */
        <div
          style={{
            maxWidth: 380,
            margin: '0 auto',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            background: '#ffffff',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
            overflow: 'hidden',
          }}
        >
          {/* Card Image Area */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: 220,
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={product.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                <Package size={44} style={{ margin: '0 auto 6px' }} />
                <span style={{ fontSize: '0.8rem' }}>No image attached</span>
              </div>
            )}

            {/* Badges Overlay */}
            <div
              style={{
                position: 'absolute',
                top: 10,
                left: 10,
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
              }}
            >
              {product.is_new_arrival && (
                <span
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 9999,
                  }}
                >
                  NEW
                </span>
              )}
              {product.is_featured && (
                <span
                  style={{
                    background: '#f59e0b',
                    color: '#fff',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 9999,
                  }}
                >
                  FEATURED
                </span>
              )}
            </div>

            <div style={{ position: 'absolute', bottom: 10, right: 10 }}>
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.92)',
                  color: '#0f172a',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 6,
                  backdropFilter: 'blur(4px)',
                }}
              >
                {product.product_code}
              </span>
            </div>
          </div>

          {/* Card Content Area */}
          <div style={{ padding: '1rem 1.25rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#64748b',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                {categoryName}
              </span>
              {brand && (
                <span style={{ fontSize: '0.75rem', color: '#334155', fontWeight: 500 }}>
                  {brand.name}
                </span>
              )}
            </div>

            <h4
              style={{
                margin: '0 0 6px',
                fontSize: '1rem',
                fontWeight: 600,
                color: '#0f172a',
                lineHeight: 1.35,
              }}
            >
              {product.name}
            </h4>

            <p
              style={{
                margin: '0 0 12px',
                fontSize: '0.8rem',
                color: '#64748b',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: 1.4,
              }}
            >
              {product.short_description || 'Industrial grade RMG and textile solution.'}
            </p>

            {/* Price Box */}
            <div
              style={{
                background: '#f8fafc',
                padding: '8px 12px',
                borderRadius: 8,
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                {currentPrice?.price_type === 'fixed' && currentPrice.min_price ? (
                  <>
                    <strong style={{ fontSize: '1.15rem', color: '#0f172a' }}>
                      {currentPrice.currency_code === 'BDT' ? '৳' : '$'}
                      {Number(currentPrice.min_price).toLocaleString()}
                    </strong>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      / {priceUnit?.symbol ?? priceUnit?.code ?? 'Unit'}
                    </span>
                  </>
                ) : currentPrice?.price_type === 'range' && currentPrice.min_price ? (
                  <>
                    <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>
                      {currentPrice.currency_code === 'BDT' ? '৳' : '$'}
                      {Number(currentPrice.min_price).toLocaleString()} –{' '}
                      {Number(currentPrice.max_price).toLocaleString()}
                    </strong>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      / {priceUnit?.symbol ?? 'Unit'}
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#2563eb' }}>
                    Quotation on Request
                  </span>
                )}
              </div>
              {currentPrice?.trade_term && (
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2 }}>
                  Term: {currentPrice.trade_term}
                </div>
              )}
              {currentTiers.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      color: '#15803d',
                      background: '#dcfce7',
                      padding: '1px 6px',
                      borderRadius: 4,
                    }}
                  >
                    Volume tiers from {currentPrice?.currency_code === 'BDT' ? '৳' : '$'}
                    {Number(currentTiers[currentTiers.length - 1].unit_price).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Logistics Meta */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                color: '#475569',
                paddingTop: 8,
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <span>
                MOQ:{' '}
                <strong>
                  {currentVariant?.minimum_order_qty
                    ? `${Number(currentVariant.minimum_order_qty)} ${saleUnit?.symbol ?? ''}`
                    : 'Flexible'}
                </strong>
              </span>
              <span style={{ color: '#16a34a', fontWeight: 600 }}>
                ● {availabilityLabel(currentVariant?.availability_status ?? 'in_stock')}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* ================= 2. FULL DETAIL PAGE HERO VIEW ================= */
        <div
          style={{
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            background: '#ffffff',
            padding: '1.5rem',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(280px, 380px) 1fr',
              gap: '2rem',
            }}
          >
            {/* Left: Gallery Simulation */}
            <div>
              <div
                style={{
                  width: '100%',
                  height: 300,
                  borderRadius: 10,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  marginBottom: 10,
                }}
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={product.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <Package size={56} style={{ color: '#94a3b8' }} />
                )}
              </div>

              {/* Multi-image thumbnail strip */}
              {assets?.images && assets.images.length > 1 && (
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                  {assets.images.map((img) => (
                    <img
                      key={img.id}
                      src={
                        img.object_manifest?.find((m) => m.kind === 'thumbnail')?.url ??
                        img.delivery_url ??
                        ''
                      }
                      alt={img.alt_text ?? 'Product thumbnail'}
                      style={{
                        width: 54,
                        height: 54,
                        borderRadius: 6,
                        objectFit: 'cover',
                        border: '1px solid #cbd5e1',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right: Technical Details & Inquiry Box */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span
                  style={{
                    fontSize: '0.8rem',
                    color: '#2563eb',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  {categoryName}
                </span>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <span style={{ fontSize: '0.8rem', color: '#475569' }}>
                  {brand?.name ?? 'ANN Traders'}
                </span>
                {product.country_of_origin && (
                  <span
                    style={{
                      background: '#f1f5f9',
                      padding: '1px 6px',
                      borderRadius: 4,
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: '#475569',
                    }}
                  >
                    Origin: {product.country_of_origin}
                  </span>
                )}
              </div>

              <h2
                style={{
                  margin: '0 0 8px',
                  fontSize: '1.45rem',
                  fontWeight: 700,
                  color: '#0f172a',
                }}
              >
                {product.name}
              </h2>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 16 }}>
                Product Code: <strong>{product.product_code}</strong>
              </div>

              {/* Price Banner */}
              <div
                style={{
                  background: '#f8fafc',
                  padding: '12px 16px',
                  borderRadius: 8,
                  marginBottom: 16,
                  border: '1px solid #f1f5f9',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  {currentPrice?.price_type === 'fixed' && currentPrice.min_price ? (
                    <>
                      <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
                        {currentPrice.currency_code === 'BDT' ? '৳' : '$'}
                        {Number(currentPrice.min_price).toLocaleString()}
                      </span>
                      <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                        per {priceUnit?.symbol ?? priceUnit?.code ?? 'Unit'}
                      </span>
                    </>
                  ) : currentPrice?.price_type === 'range' && currentPrice.min_price ? (
                    <>
                      <span style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>
                        {currentPrice.currency_code === 'BDT' ? '৳' : '$'}
                        {Number(currentPrice.min_price).toLocaleString()} –{' '}
                        {Number(currentPrice.max_price).toLocaleString()}
                      </span>
                      <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                        per {priceUnit?.symbol ?? 'Unit'}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#2563eb' }}>
                      Price on Request (B2B Quotation)
                    </span>
                  )}
                </div>
                {currentPrice?.trade_term && (
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 4 }}>
                    Delivery Term: <strong>{currentPrice.trade_term}</strong>
                  </div>
                )}
              </div>

              {/* Wholesale Volume Discount Tiers Matrix */}
              {currentTiers.length > 0 && (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: 8,
                    padding: '12px 14px',
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <strong
                      style={{
                        fontSize: '0.78rem',
                        color: '#166534',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      B2B Volume Discount Tiers
                    </strong>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        color: '#15803d',
                        fontWeight: 600,
                        background: '#dcfce7',
                        padding: '1px 6px',
                        borderRadius: 4,
                      }}
                    >
                      Quantity Discounts
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${Math.min(currentTiers.length, 4)}, 1fr)`,
                      gap: 8,
                    }}
                  >
                    {currentTiers.map((t, idx) => {
                      const tierUnit =
                        units?.rows.find((u) => u.id === t.quantity_unit_id)?.symbol ??
                        priceUnit?.symbol ??
                        'unit';
                      return (
                        <div
                          key={t.id || idx}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #bbf7d0',
                            borderRadius: 6,
                            padding: '8px 10px',
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                            {t.max_quantity
                              ? `${Number(t.min_quantity).toLocaleString()} – ${Number(t.max_quantity).toLocaleString()} ${tierUnit}`
                              : `${Number(t.min_quantity).toLocaleString()}+ ${tierUnit}`}
                          </div>
                          <div
                            style={{
                              fontSize: '0.98rem',
                              fontWeight: 700,
                              color: '#15803d',
                              marginTop: 2,
                            }}
                          >
                            {currentPrice?.currency_code === 'BDT' ? '৳' : '$'}
                            {Number(t.unit_price).toLocaleString()}
                          </div>
                          <small style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                            per {tierUnit}
                          </small>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Variant Selector Pills */}
              {activeVariants.length > 1 && (
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#475569',
                      marginBottom: 6,
                    }}
                  >
                    Select Configuration / SKU:
                  </label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {activeVariants.map((v, idx) => (
                      <button
                        key={v.sku}
                        type="button"
                        onClick={() => setSelectedVariantIndex(idx)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          border:
                            selectedVariantIndex === idx
                              ? '2px solid #2563eb'
                              : '1px solid #cbd5e1',
                          background: selectedVariantIndex === idx ? '#eff6ff' : '#ffffff',
                          color: selectedVariantIndex === idx ? '#1d4ed8' : '#334155',
                        }}
                      >
                        {v.variant_name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Logistics & Availability Metrics */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 10,
                  marginBottom: 16,
                  padding: '10px 12px',
                  background: '#f8fafc',
                  borderRadius: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>MIN. ORDER (MOQ)</div>
                  <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>
                    {currentVariant?.minimum_order_qty
                      ? `${Number(currentVariant.minimum_order_qty)} ${saleUnit?.symbol ?? ''}`
                      : 'Flexible'}
                  </strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>LEAD TIME</div>
                  <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>
                    {currentVariant?.lead_time_days
                      ? `${currentVariant.lead_time_days} Days`
                      : 'Immediate'}
                  </strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>SUPPLY CAPACITY</div>
                  <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>
                    {currentVariant?.monthly_supply_capacity
                      ? `${Number(currentVariant.monthly_supply_capacity).toLocaleString()} /mo`
                      : 'Available'}
                  </strong>
                </div>
              </div>

              {/* Description & Key Features */}
              <p
                style={{
                  fontSize: '0.85rem',
                  color: '#475569',
                  lineHeight: 1.5,
                  marginBottom: 16,
                }}
              >
                {product.description || product.short_description || 'Commercial textile supply item.'}
              </p>

              {/* Technical Specifications & Downloads Section */}
              {assets?.documents &&
                assets.documents.filter((d) => d.is_public).length > 0 && (
                  <div style={{ marginBottom: 16, borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        letterSpacing: '0.5px',
                        color: '#64748b',
                        marginBottom: 8,
                        textTransform: 'uppercase',
                      }}
                    >
                      Technical Data & Certification Downloads
                    </span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {assets.documents
                        .filter((d) => d.is_public)
                        .map((doc) => (
                          <div
                            key={doc.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '5px 10px',
                              borderRadius: 6,
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              fontSize: '0.78rem',
                              color: '#1e293b',
                              fontWeight: 500,
                            }}
                          >
                            <FileText size={14} style={{ color: '#dc2626' }} />
                            <span>{doc.title}</span>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                background: '#e0e7ff',
                                color: '#3730a3',
                                padding: '1px 5px',
                                borderRadius: 4,
                                fontWeight: 600,
                              }}
                            >
                              {doc.document_type}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

              {/* Call-to-Action Mockup */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '0.6rem 1rem' }}
                  onClick={() => alert('Storefront simulation: this opens the customer B2B quote request form.')}
                >
                  Request B2B Quotation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
