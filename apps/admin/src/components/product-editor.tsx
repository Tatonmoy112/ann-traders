'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Save,
  Plus,
  CheckCircle2,
  AlertCircle,
  Globe,
  FilePenLine,
  Archive,
  Trash2,
  RotateCcw,
  Copy,
} from 'lucide-react';
import { z } from 'zod';
import { productInput, saveDraftInput, variantInput, priceInput } from '@ann/validation';
import { type Product, type FieldConfig } from '@ann/database';
import { Badge, Button, Field, Modal } from '@ann/ui';
import { formatPrice } from '@ann/domain';
import { api } from '@/lib/client';
import { Lookup, RecordFields, type Row } from './record-form';
import { RelationEditor } from './relation-editor';
import { ProductAssets } from './product-assets';
import { StorefrontPreview } from './storefront-preview';
type Variant = z.infer<typeof variantInput>;
type Price = z.infer<typeof priceInput>;
type Detail = { product: Product; variants: Variant[]; prices: Price[] };
const variantFields: FieldConfig[] = [
  { key: 'sku', label: 'SKU', required: true },
  { key: 'variant_name', label: 'Variant name', required: true },
  { key: 'model_number', label: 'Model / part number' },
  { key: 'base_unit_id', label: 'Sale unit', lookup: 'units', required: true },
  { key: 'minimum_order_qty', label: 'MOQ quantity' },
  { key: 'minimum_order_unit_id', label: 'MOQ unit', lookup: 'units', required: true },
  { key: 'monthly_supply_capacity', label: 'Monthly supply capacity' },
  { key: 'capacity_unit_id', label: 'Capacity unit', lookup: 'units', required: true },
  { key: 'lead_time_days', label: 'Lead time (days)', type: 'number' },
  {
    key: 'availability_status',
    label: 'Availability',
    type: 'select',
    options: ['in_stock', 'out_of_stock', 'made_to_order', 'pre_order', 'on_request'],
    required: true,
  },
  { key: 'is_active', label: 'Active variant', type: 'boolean' },
];
const basicsFields: FieldConfig[] = [
  { key: 'name', label: 'Product name', required: true },
  { key: 'product_code', label: 'Product code', required: true },
  { key: 'slug', label: 'URL slug', required: true },
  { key: 'primary_category_id', label: 'Primary category', lookup: 'categories' },
  { key: 'brand_id', label: 'Brand', lookup: 'brands' },
  {
    key: 'product_type',
    label: 'Product type',
    type: 'select',
    options: ['physical', 'software', 'service'],
    required: true,
  },
  { key: 'country_of_origin', label: 'Origin country', hint: 'Two-letter ISO country code' },
  { key: 'short_description', label: 'Short description', type: 'textarea' },
  { key: 'description', label: 'Full description', type: 'textarea' },
  { key: 'is_featured', label: 'Featured product', type: 'boolean' },
  { key: 'is_new_arrival', label: 'New arrival', type: 'boolean' },
  { key: 'seo_title', label: 'SEO title' },
  { key: 'seo_description', label: 'SEO description', type: 'textarea' },
];
export function ProductEditor({ id, canPublish }: { id: string; canPublish: boolean }) {
  const query = useQuery({
    queryKey: ['product', id],
    queryFn: () => api<Detail>(`/api/admin/products/${id}`),
  });
  if (query.error)
    return (
      <div className="alert" role="alert">
        {query.error.message}
        <Button variant="outline" onClick={() => query.refetch()}>
          Retry
        </Button>
      </div>
    );
  if (!query.data)
    return (
      <div className="panel form-body">
        <div className="skeleton" />
        Loading product…
      </div>
    );
  return (
    <Editor
      key={`${id}:${query.data.product.revision}`}
      id={id}
      detail={query.data}
      canPublish={canPublish}
    />
  );
}
function Editor({ id, detail, canPublish }: { id: string; detail: Detail; canPublish: boolean }) {
  const router = useRouter(),
    client = useQueryClient(),
    [tab, setTab] = useState('Basics'),
    [product, setProduct] = useState(() => productInput.parse(detail.product)),
    [variants, setVariants] = useState(detail.variants),
    [prices, setPrices] = useState(detail.prices),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(''),
    [duplicating, setDuplicating] = useState(false),
    [action, setAction] = useState<string | null>(null);
  const editable = detail.product.status === 'draft' && !detail.product.deleted_at,
    revision = detail.product.revision;
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    const click = (e: MouseEvent) => {
      const link = (e.target as Element).closest('a');
      if (
        dirty &&
        link &&
        link.href !== window.location.href &&
        !window.confirm('Discard unsaved product changes?')
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', before);
    document.addEventListener('click', click, true);
    return () => {
      window.removeEventListener('beforeunload', before);
      document.removeEventListener('click', click, true);
    };
  }, [dirty]);
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['product', id] }),
      client.invalidateQueries({ queryKey: ['products'] }),
      client.invalidateQueries({ queryKey: ['review', id] }),
    ]);
  };
  const save = useMutation({
    mutationFn: async () => {
      const payload = saveDraftInput.parse({ id, revision, product, variants, prices });
      return api(`/api/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    },
    onSuccess: async () => {
      setDirty(false);
      await refresh();
    },
    onError: (e) => setError(e.message),
  });
  const lifecycle = useMutation({
    mutationFn: () =>
      api(`/api/admin/products/${id}`, {
        method: 'POST',
        body: JSON.stringify({ id, revision, action }),
      }),
    onSuccess: async () => {
      setAction(null);
      await refresh();
    },
    onError: (e) => setError(e.message),
  });
  const review = useQuery({
    queryKey: ['review', id, revision],
    queryFn: () => api<string[]>(`/api/admin/products/${id}/review`),
    enabled: tab === 'Review & publish',
  });
  const localChoices: Record<string, Row[]> = {
    product_variants: variants as unknown as Row[],
    variant_prices: prices.map((p) => {
      const v = variants.find((x) => x.id === p.variant_id);
      const vName = v?.variant_name ?? 'Variant';
      const pLabel =
        p.price_type === 'on_request'
          ? 'Price on request'
          : p.min_price
            ? `${p.currency_code} ${p.min_price}${p.max_price ? ` - ${p.max_price}` : ''}`
            : p.currency_code;
      const label = `${vName} · ${pLabel}`;
      return {
        ...p,
        label,
        name: label,
      };
    }) as unknown as Row[],
  };
  const updateVariant = (index: number, next: Variant) => {
    setDirty(true);
    setVariants(variants.map((v, i) => (i === index ? next : v)));
  };
  const groups: Record<string, string[]> = {
    Pricing: ['price_tiers'],
    Specifications: ['product_attribute_values', 'variant_attribute_values'],
    Packaging: ['variant_packaging'],
    Classification: [
      'product_extra_categories',
      'product_industries',
      'product_applications',
      'product_certifications',
      'variant_fiber_composition',
      'variant_equipment_compatibility',
    ],
  };
  return (
    <>
      <Link className="back-link" href="/products">
        <ArrowLeft size={15} />
        All products
      </Link>
      <div className="page-heading editor-heading">
        <div>
          <span className="eyebrow">{detail.product.product_code}</span>
          <h1>
            {detail.product.name}
            <Badge status={detail.product.deleted_at ? 'archived' : detail.product.status}>
              {detail.product.deleted_at ? 'Deleted' : detail.product.status}
            </Badge>
          </h1>
          <p>
            Revision {revision} · {dirty ? 'Unsaved changes' : 'All changes saved'} · Private
            catalog workspace
          </p>
        </div>
        <div className="heading-actions">
          <Button
            variant="outline"
            disabled={duplicating}
            title="Duplicate this product as a new draft"
            onClick={async () => {
              if (dirty && !window.confirm('You have unsaved changes. Duplicate from the last saved state?'))
                return;
              setDuplicating(true);
              try {
                const res = await api<{ id: string }>(`/api/admin/products/${id}/duplicate`, {
                  method: 'POST',
                });
                router.push(`/products/${res.id}`);
              } catch (err) {
                setError((err as Error).message);
                setDuplicating(false);
              }
            }}
          >
            <Copy size={16} />
            {duplicating ? 'Duplicating…' : 'Duplicate'}
          </Button>
          {editable ? (
            <Button
              disabled={!dirty || save.isPending}
              onClick={() => {
                setError('');
                save.mutate();
              }}
            >
              <Save size={16} />
              {save.isPending ? 'Saving…' : 'Save draft'}
            </Button>
          ) : (
            canPublish && (
              <Button
                variant="outline"
                onClick={() => setAction(detail.product.deleted_at ? 'restore' : 'unpublish')}
              >
                <FilePenLine size={16} />
                {detail.product.deleted_at ? 'Restore to draft' : 'Return to draft'}
              </Button>
            )
          )}
        </div>
      </div>
      {error && (
        <div className="alert" role="alert">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError('')}>
            ×
          </button>
        </div>
      )}
      {!editable && (
        <div className="notice">
          <Globe size={17} />
          Return this product to draft before editing its details and relationships.
        </div>
      )}
      <div className="editor-tabs">
        {[
          'Basics',
          'Variants',
          'Pricing',
          'Specifications',
          'Packaging',
          'Images & documents',
          'Classification',
          'Review & publish',
        ].map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Basics' && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Product information</h2>
              <p>The identity and story behind this product.</p>
            </div>
          </div>
          <div className="form-body">
            <RecordFields
              fields={basicsFields}
              value={product as unknown as Row}
              onChange={(next) => {
                setProduct(next as unknown as typeof product);
                setDirty(true);
              }}
              disabled={!editable}
            />
          </div>
        </section>
      )}
      {tab === 'Variants' && (
        <>
          <div className="section-label">
            <div>
              <h2>Product variants</h2>
              <p className="muted">
                Each SKU represents a distinct configuration. Deactivate historical variants to
                retain their records.
              </p>
            </div>
            {editable && (
              <Button
                variant="outline"
                onClick={() => {
                  setDirty(true);
                  setVariants([
                    ...variants,
                    {
                      id: crypto.randomUUID(),
                      sku: '',
                      variant_name: '',
                      model_number: null,
                      base_unit_id: null,
                      minimum_order_qty: null,
                      minimum_order_unit_id: null,
                      monthly_supply_capacity: null,
                      capacity_unit_id: null,
                      lead_time_days: null,
                      availability_status: 'on_request',
                      is_default: variants.length === 0,
                      is_active: true,
                    },
                  ]);
                }}
              >
                <Plus size={15} />
                Add variant
              </Button>
            )}
          </div>
          {variants.map((v, index) => (
            <section className="panel variant-card" key={v.id}>
              <div className="panel-heading">
                <h2>{v.sku || `Variant ${index + 1}`}</h2>
                <label className="checkbox-field">
                  <input
                    type="radio"
                    name="default-variant"
                    checked={v.is_default}
                    disabled={!editable || !v.is_active}
                    onChange={() => {
                      setVariants(variants.map((x) => ({ ...x, is_default: x.id === v.id })));
                      setDirty(true);
                    }}
                  />
                  Default variant
                </label>
              </div>
              <div className="form-body">
                <RecordFields
                  fields={variantFields}
                  value={v as unknown as Row}
                  onChange={(next) => updateVariant(index, next as unknown as Variant)}
                  disabled={!editable}
                />
              </div>
            </section>
          ))}
          {!variants.length && (
            <div className="panel empty-state">
              <h3>Add the first configuration</h3>
              <p>Every published product needs an active default variant.</p>
            </div>
          )}
        </>
      )}
      {tab === 'Pricing' && (
        <>
          <div className="section-label">
            <div>
              <h2>Variant pricing</h2>
              <p className="muted">
                Prices are catalog information, subject to quotation. Append new prices to preserve
                history.
              </p>
            </div>
            {editable && (
              <Button
                variant="outline"
                disabled={!variants.length}
                onClick={() => {
                  setDirty(true);
                  setPrices([
                    ...prices,
                    {
                      id: crypto.randomUUID(),
                      variant_id: variants[0].id,
                      currency_code: 'BDT',
                      price_type: 'on_request',
                      min_price: null,
                      max_price: null,
                      price_unit_id: variants[0].base_unit_id ?? '',
                      trade_term: '',
                      valid_from: new Date().toISOString(),
                      valid_until: null,
                      is_active: true,
                    },
                  ]);
                }}
              >
                <Plus size={15} />
                Add price
              </Button>
            )}
          </div>
          {prices.map((p, i) => {
            const historical = detail.prices.some((x) => x.id === p.id);
            const update = (next: Price) => {
              setDirty(true);
              setPrices(prices.map((v, j) => (i === j ? next : v)));
            };
            return (
              <section className="panel price-card" key={p.id}>
                <div className="panel-heading">
                  <div>
                    <h2>
                      {formatPrice(p.price_type, p.min_price, p.max_price, p.currency_code, 'unit')}
                    </h2>
                    <p>
                      {historical
                        ? 'Saved price · amounts and effective dates are immutable'
                        : 'New price record'}
                    </p>
                  </div>
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      disabled={!editable}
                      checked={p.is_active}
                      onChange={(e) => update({ ...p, is_active: e.target.checked })}
                    />
                    Active
                  </label>
                </div>
                <div className="form-body">
                  <fieldset disabled={!editable || historical}>
                    <div className="form-grid">
                      <Field label="Variant">
                        <Lookup
                          table="product_variants"
                          choices={localChoices.product_variants}
                          value={p.variant_id}
                          onChange={(v) => update({ ...p, variant_id: v })}
                        />
                      </Field>
                      <Field label="Currency">
                        <select
                          value={p.currency_code}
                          onChange={(e) =>
                            update({ ...p, currency_code: e.target.value as 'BDT' | 'USD' })
                          }
                        >
                          <option>BDT</option>
                          <option>USD</option>
                        </select>
                      </Field>
                      <Field label="Price type">
                        <select
                          value={p.price_type}
                          onChange={(e) =>
                            update({
                              ...p,
                              price_type: e.target.value as Price['price_type'],
                              min_price: null,
                              max_price: null,
                            })
                          }
                        >
                          {['on_request', 'fixed', 'range'].map((t) => (
                            <option key={t} value={t}>
                              {t.replaceAll('_', ' ')}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Price unit">
                        <Lookup
                          table="units"
                          value={p.price_unit_id}
                          onChange={(v) => update({ ...p, price_unit_id: v })}
                          required
                        />
                      </Field>
                      {p.price_type !== 'on_request' && (
                        <Field label={p.price_type === 'range' ? 'Minimum price' : 'Unit price'}>
                          <input
                            inputMode="decimal"
                            value={p.min_price ?? ''}
                            onChange={(e) => update({ ...p, min_price: e.target.value || null })}
                          />
                        </Field>
                      )}
                      {p.price_type === 'range' && (
                        <Field label="Maximum price">
                          <input
                            inputMode="decimal"
                            value={p.max_price ?? ''}
                            onChange={(e) => update({ ...p, max_price: e.target.value || null })}
                          />
                        </Field>
                      )}
                      <Field label="Trade term">
                        <input
                          value={p.trade_term}
                          onChange={(e) => update({ ...p, trade_term: e.target.value })}
                        />
                      </Field>
                      <Field label="Valid from (UTC)">
                        <input
                          type="datetime-local"
                          value={p.valid_from.slice(0, 16)}
                          onChange={(e) =>
                            update({
                              ...p,
                              valid_from: e.target.value ? e.target.value + ':00.000Z' : '',
                            })
                          }
                        />
                      </Field>
                      <Field label="Valid until (UTC)">
                        <input
                          type="datetime-local"
                          value={p.valid_until?.slice(0, 16) ?? ''}
                          onChange={(e) =>
                            update({
                              ...p,
                              valid_until: e.target.value ? e.target.value + ':00.000Z' : null,
                            })
                          }
                        />
                      </Field>
                    </div>
                  </fieldset>
                </div>
              </section>
            );
          })}
          {!prices.length && (
            <div className="panel empty-state">
              <h3>Define how this product is priced</h3>
              <p>Choose a fixed price, range, or Price on request for each active variant.</p>
            </div>
          )}
        </>
      )}
      {groups[tab] &&
        (editable && !dirty ? (
          groups[tab].map((table) => (
            <RelationEditor
              key={table}
              id={id}
              revision={revision}
              table={table}
              categoryId={detail.product.primary_category_id}
              localChoices={localChoices}
              onSaved={refresh}
            />
          ))
        ) : (
          <div className="notice">
            {dirty
              ? 'Save your product changes before editing related records.'
              : 'Return the product to draft to edit related records.'}
          </div>
        ))}
      {tab === 'Images & documents' && (
        <ProductAssets
          id={id}
          revision={revision}
          editable={editable && !dirty}
          onSaved={refresh}
        />
      )}{' '}
      {tab === 'Review & publish' && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Ready for the public catalog?</h2>
              <p>Review the saved product before making it visible.</p>
            </div>
            <CheckCircle2 size={22} />
          </div>
          <div className="form-body">
            {dirty && <div className="notice">Save unsaved changes before reviewing.</div>}
            {review.isPending ? (
              <p>Checking publication requirements…</p>
            ) : review.error ? (
              <div className="alert">{review.error.message}</div>
            ) : review.data?.length ? (
              <div className="review-list">
                {review.data.map((message, i) => (
                  <div key={i}>
                    <AlertCircle size={17} />
                    {message}
                  </div>
                ))}
              </div>
            ) : (
              <div className="success">
                <CheckCircle2 size={19} />
                All publication requirements are satisfied.
              </div>
            )}
            <StorefrontPreview
              id={id}
              product={detail.product}
              variants={variants}
              prices={prices}
            />
            {canPublish && (
              <div className="lifecycle-actions">
                {editable && (
                  <Button
                    disabled={
                      dirty ||
                      Boolean(review.data?.length) ||
                      review.isPending ||
                      Boolean(review.error)
                    }
                    onClick={() => setAction('publish')}
                  >
                    <Globe size={16} />
                    Publish product
                  </Button>
                )}
                <Button variant="outline" disabled={dirty} onClick={() => setAction('archive')}>
                  <Archive size={16} />
                  Archive
                </Button>
                <Button variant="danger" disabled={dirty} onClick={() => setAction('delete')}>
                  <Trash2 size={16} />
                  Move to trash
                </Button>
                {detail.product.deleted_at && (
                  <Button variant="outline" onClick={() => setAction('restore')}>
                    <RotateCcw size={16} />
                    Restore
                  </Button>
                )}
              </div>
            )}
          </div>
        </section>
      )}
      {action && (
        <Modal
          title={`${action.charAt(0).toUpperCase() + action.slice(1)} product?`}
          description={`This changes the visibility of ${detail.product.name}. The operation is recorded in the activity log.`}
          onClose={() => setAction(null)}
        >
          <div className="form-body">
            {error && <div className="alert">{error}</div>}
            <p>
              {action === 'publish'
                ? 'The saved product will become available through the public catalog projection.'
                : action === 'delete'
                  ? 'The product will be hidden and retained in trash for restoration.'
                  : 'Public visibility will be updated after this action.'}
            </p>
          </div>
          <div className="form-footer">
            <Button variant="outline" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button disabled={lifecycle.isPending} onClick={() => lifecycle.mutate()}>
              {lifecycle.isPending ? 'Updating…' : 'Confirm'}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
