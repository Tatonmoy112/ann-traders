'use client';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import type { FieldConfig } from '@ann/database';
import { Field } from '@ann/ui';
import { api } from '@/lib/client';
export type RecordValue = string | number | boolean | null;
export type Row = Record<string, RecordValue>;
export function Lookup({
  table,
  value,
  onChange,
  required,
  choices,
  disabled,
  id,
  'aria-describedby': description,
}: {
  table: string;
  value: RecordValue;
  onChange: (v: string) => void;
  required?: boolean;
  choices?: Row[];
  disabled?: boolean;
  id?: string;
  'aria-describedby'?: string;
}) {
  const local = choices !== undefined;
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const { data, error } = useQuery({
    queryKey: ['lookup', table, deferredSearch, value],
    queryFn: () =>
      api<{ rows: Row[]; total: number }>(
        `/api/admin/masters/${table}?${new URLSearchParams({ lookup: 'true', q: deferredSearch, selected: String(value || '') })}`,
      ),
    enabled: !local,
  });
  return (
    <>
      {!local && (
        <input
          aria-label={`Search ${table.replaceAll('_', ' ')}`}
          placeholder="Search options"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          disabled={disabled}
        />
      )}
      <select
        id={id}
        aria-describedby={description}
        value={String(value ?? '')}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || Boolean(error)}
      >
        <option value="">{error ? 'Could not load options' : 'Select…'}</option>
        {(choices ?? data?.rows ?? []).map((r, i) => (
          <option key={String(r.id ?? i)} value={String(r.id)}>
            {String(
              r.name ??
                r.variant_name ??
                r.model_name ??
                r.label ??
                r.title ??
                `${r.currency_code ?? ''} ${r.price_type ?? ''} · ${String(r.id).slice(0, 8)}`,
            )}
          </option>
        ))}
      </select>
      {!local && data && data.total > 500 && (
        <small>Showing the first 500 matches. Search to find another option.</small>
      )}
    </>
  );
}
export function RecordFields({
  fields,
  value,
  onChange,
  localChoices = {},
  disabled = false,
}: {
  fields: FieldConfig[];
  value: Row;
  onChange: (v: Row) => void;
  localChoices?: Record<string, Row[]>;
  disabled?: boolean;
}) {
  return (
    <div className="form-grid">
      {fields.map((f) => {
        const current = value[f.key] ?? '',
          change = (v: RecordValue) => onChange({ ...value, [f.key]: v === '' ? null : v });
        return (
          <Field key={f.key} label={f.label} hint={f.hint}>
            {f.lookup ? (
              <Lookup
                table={f.lookup}
                required={f.required}
                value={current}
                onChange={change}
                choices={localChoices[f.lookup]}
                disabled={disabled}
              />
            ) : f.type === 'boolean' ? (
              <span className="checkbox-field">
                <input
                  type="checkbox"
                  checked={Boolean(current)}
                  onChange={(e) => change(e.target.checked)}
                  disabled={disabled}
                />
                Enabled
              </span>
            ) : f.options ? (
              <select
                required={f.required}
                value={String(current)}
                onChange={(e) => change(e.target.value)}
                disabled={disabled}
              >
                <option value="">Select…</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea
                value={String(current)}
                onChange={(e) => change(e.target.value)}
                disabled={disabled}
              />
            ) : f.type === 'image' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {current ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Image
                      unoptimized
                      width={56}
                      height={56}
                      src={String(current)}
                      alt={f.label}
                      style={{
                        width: 56,
                        height: 56,
                        objectFit: 'contain',
                        borderRadius: 6,
                        border: '1px solid #e2e8f0',
                        background: '#f8fafc',
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span
                        style={{ fontSize: '0.75rem', color: '#64748b', wordBreak: 'break-all' }}
                      >
                        {String(current).length > 40
                          ? String(current).slice(0, 37) + '…'
                          : String(current)}
                      </span>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.15rem 0.4rem',
                          width: 'fit-content',
                        }}
                        onClick={() => change(null)}
                        disabled={disabled}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : null}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={disabled}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const form = new FormData();
                    form.append('file', file);
                    form.append('table', f.key === 'logo_path' ? 'brands' : 'categories');
                    try {
                      const res = await fetch('/api/admin/images/upload-master', {
                        method: 'POST',
                        body: form,
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Upload failed');
                      change(data.url);
                    } catch (err) {
                      alert((err as Error).message);
                    } finally {
                      e.target.value = '';
                    }
                  }}
                />
              </div>
            ) : (
              <input
                type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                required={f.required}
                value={String(current)}
                onChange={(e) =>
                  change(
                    f.type === 'number' && e.target.value !== ''
                      ? Number(e.target.value)
                      : e.target.value,
                  )
                }
                disabled={disabled}
              />
            )}
          </Field>
        );
      })}
    </div>
  );
}
export function defaults(fields: FieldConfig[]): Row {
  return Object.fromEntries(
    fields.map((f) => [
      f.key,
      f.type === 'boolean' ? f.key === 'is_active' : f.type === 'number' ? 0 : null,
    ]),
  );
}
