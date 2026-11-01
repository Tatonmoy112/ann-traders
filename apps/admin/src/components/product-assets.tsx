'use client';
import Image from 'next/image';
import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, Star, Trash2, Download } from 'lucide-react';
import { Button, Field, Badge, Modal } from '@ann/ui';
import { api } from '@/lib/client';

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

type Assets = {
  images: {
    id: string;
    delivery_url: string | null;
    upload_status: string;
    is_primary: boolean;
    alt_text: string | null;
    object_manifest?: { kind: string; url: string; width: number }[];
    sort_order: number;
    variant_id?: string | null;
  }[];
  documents: {
    id: string;
    title: string;
    document_type: string;
    is_public: boolean;
    created_at?: string;
    bytes?: number | null;
    file_extension?: string | null;
    variant_id?: string | null;
  }[];
};
export function ProductAssets({
  id,
  revision,
  editable,
  onSaved,
  variants = [],
}: {
  id: string;
  revision: number;
  editable: boolean;
  onSaved: () => void;
  variants?: { id: string; variant_name: string }[];
}) {
  const client = useQueryClient(),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(''),
    [file, setFile] = useState<File | null>(null),
    [title, setTitle] = useState(''),
    [kind, setKind] = useState('TDS'),
    [visible, setVisible] = useState(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const [retry, setRetry] = useState<{ image: File; replacement?: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDraggingPdf, setIsDraggingPdf] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Assets['documents'][number] | null>(null);

  const handlePdfSelect = (selectedFile: File | null) => {
    if (!selectedFile) {
      setFile(null);
      return;
    }
    if (
      selectedFile.type !== 'application/pdf' &&
      !selectedFile.name.toLowerCase().endsWith('.pdf')
    ) {
      setError('Only PDF documents are supported for technical attachments.');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('PDF file size exceeds 10 MB limit.');
      return;
    }
    setError('');
    setFile(selectedFile);
    if (!title.trim()) {
      const cleanName = selectedFile.name
        .replace(/\.pdf$/i, '')
        .replace(/[-_]+/g, ' ')
        .trim();
      setTitle(cleanName);
    }
  };

  const handleDeleteDocument = async (docId: string, docTitle: string) => {
    if (
      !window.confirm(
        `Retire "${docTitle}" from this draft? Its file and history will be retained.`,
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/documents/${docId}`, {
        method: 'DELETE',
        body: JSON.stringify({ product: id, revision }),
      });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const { data, error: queryError } = useQuery({
    queryKey: ['assets', id],
    queryFn: () => api<Assets>(`/api/admin/products/${id}/assets`),
  });
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ['assets', id] });
    onSaved();
  };
  const action = async (media: string, operation: string, alt = '') => {
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/products/${id}/assets`, {
        method: 'POST',
        body: JSON.stringify({ media, revision, operation, alt }),
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const upload = async (image: File, replacement?: string) => {
    setBusy(true);
    setError('');
    setProgress(0);
    setRetry({ image, replacement });
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type) || image.size > 10485760)
        throw new Error('Use a JPEG, PNG, or WebP image up to 10 MB.');
      const bitmap = await createImageBitmap(image);
      const valid =
        bitmap.width >= 100 &&
        bitmap.height >= 100 &&
        bitmap.width <= 12000 &&
        bitmap.height <= 12000;
      bitmap.close();
      if (!valid) throw new Error('Image dimensions must be between 100 and 12,000 pixels.');
      const stage = await api<{
        media: string;
        uploadURL: string;
        headers: Record<string, string>;
      }>('/api/admin/images/create-upload', {
        method: 'POST',
        body: JSON.stringify({
          product: id,
          revision,
          mime: image.type,
          bytes: image.size,
          replacement,
        }),
      });
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        setUploading(true);
        xhr.open('PUT', stage.uploadURL);
        Object.entries(stage.headers).forEach(([name, value]) => xhr.setRequestHeader(name, value));
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error('Image upload failed. Please retry.'));
        xhr.onerror = () => reject(new Error('Image upload failed. Check your connection.'));
        xhr.onabort = () =>
          reject(new Error('Image upload cancelled. Retry with a new upload session.'));
        xhr.timeout = 120000;
        xhr.ontimeout = () => reject(new Error('Image upload timed out.'));
        xhr.send(image);
      });
      setUploading(false);
      xhrRef.current = null;
      await api('/api/admin/images/complete-upload', {
        method: 'POST',
        body: JSON.stringify({ product: id, revision, media: stage.media }),
      });
      await refresh();
      setRetry(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      xhrRef.current = null;
      setUploading(false);
      setBusy(false);
    }
  };
  return (
    <>
      {(error || queryError) && (
        <div className="alert" role="alert">
          {error || queryError?.message}
        </div>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Product images</h2>
            <p>Verified product imagery for the public catalog.</p>
          </div>
          <Upload size={19} />
        </div>
        <div className="form-body">
          <div className="image-grid">
            {data?.images.map((m) => (
              <div className="image-card" key={m.id}>
                {m.delivery_url && m.upload_status === 'ready' ? (
                  <Image
                    src={
                      m.object_manifest?.find((v) => v.kind === 'thumbnail')?.url ?? m.delivery_url
                    }
                    alt={m.alt_text ?? 'Product image'}
                    width={240}
                    height={180}
                    sizes="240px"
                    unoptimized
                  />
                ) : (
                  <div className="pending-image">{m.upload_status}</div>
                )}
                <div className="image-card-actions">
                  <Badge status={m.is_primary ? 'published' : 'draft'}>
                    {m.is_primary ? 'Primary' : m.upload_status}
                  </Badge>
                  {editable && (
                    <>
                      <button
                        className="icon-button"
                        disabled={busy}
                        aria-label="Set primary image"
                        onClick={() => action(m.id, 'primary')}
                      >
                        <Star size={15} />
                      </button>
                      <button
                        className="icon-button"
                        disabled={busy}
                        aria-label="Detach image"
                        onClick={() => {
                          if (window.confirm('Detach this image? Provider cleanup will be queued.'))
                            void action(m.id, 'detach');
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                      {m.upload_status === 'ready' && (
                        <label className="icon-button" title="Replace image">
                          <Upload size={15} />
                          <input
                            aria-label="Replace image"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={busy}
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              if (e.target.files?.[0]) void upload(e.target.files[0], m.id);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                      <button
                        className="icon-button"
                        disabled={busy || m.sort_order === 0}
                        aria-label="Move image earlier"
                        onClick={() => action(m.id, 'order', String(Math.max(0, m.sort_order - 1)))}
                      >
                        ↑
                      </button>
                      <button
                        className="icon-button"
                        disabled={busy}
                        aria-label="Move image later"
                        onClick={() => action(m.id, 'order', String(m.sort_order + 1))}
                      >
                        ↓
                      </button>
                    </>
                  )}
                </div>
                {editable && (
                  <select
                    aria-label="Image variant"
                    value={m.variant_id || ''}
                    disabled={busy || m.upload_status !== 'ready'}
                    onChange={(event) => void action(m.id, 'variant', event.target.value)}
                  >
                    <option value="">All variants</option>
                    {variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.variant_name}
                      </option>
                    ))}
                  </select>
                )}
                {editable && (
                  <input
                    aria-label="Image alt text"
                    placeholder="Describe this image"
                    defaultValue={m.alt_text ?? ''}
                    onBlur={(e) => {
                      if (e.target.value !== (m.alt_text ?? ''))
                        void action(m.id, 'alt', e.target.value);
                    }}
                    disabled={busy}
                  />
                )}
              </div>
            ))}
          </div>
          {editable && (
            <label className={`upload-zone ${busy ? 'disabled' : ''}`}>
              <Upload size={25} />
              <strong>{busy ? `Uploading… ${progress}%` : 'Choose a product image'}</strong>
              <span>JPEG, PNG or WebP · maximum 10 MB</span>
              <input
                aria-label="Upload product image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(e) => {
                  if (e.target.files?.[0]) void upload(e.target.files[0]);
                  e.target.value = '';
                }}
              />
            </label>
          )}
        </div>
      </section>
      {!busy && retry && (
        <Button variant="outline" onClick={() => upload(retry.image, retry.replacement)}>
          Retry image upload
        </Button>
      )}
      {busy && (
        <Button variant="outline" disabled={!uploading} onClick={() => xhrRef.current?.abort()}>
          Cancel upload
        </Button>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Technical documents</h2>
            <p>Specification sheets, TDS, MSDS, OEKO-TEX / GOTS certificates and manuals.</p>
          </div>
          <FileText size={19} />
        </div>
        <div className="form-body">
          {data?.documents && data.documents.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.documents.map((d) => (
                <div
                  key={d.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: '#fee2e2',
                        color: '#dc2626',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <FileText size={18} />
                    </div>
                    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                      >
                        <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>{d.title}</strong>
                        <span
                          style={{
                            background: '#e0e7ff',
                            color: '#3730a3',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '1px 7px',
                            borderRadius: 9999,
                          }}
                        >
                          {d.document_type}
                        </span>
                        {d.bytes ? (
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {formatBytes(d.bytes)}
                          </span>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: d.is_public ? '#059669' : '#d97706',
                            fontWeight: 500,
                          }}
                        >
                          {d.is_public ? '● Public on Storefront' : '○ Internal Only'}
                        </span>
                        {d.created_at && (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            · Uploaded {new Date(d.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Button
                      variant="outline"
                      style={{ fontSize: '0.8rem', padding: '4px 10px', minHeight: 32 }}
                      onClick={async () => {
                        try {
                          const result = await api<{ url: string }>(`/api/admin/documents/${d.id}`);
                          window.open(result.url, '_blank', 'noopener,noreferrer');
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      <Download size={14} /> Download
                    </Button>
                    {editable && (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => setEditingDocument({ ...d })}
                      >
                        Edit document
                      </Button>
                    )}
                    {editable && (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setError('');
                          try {
                            await api(`/api/admin/documents/${d.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({
                                product: id,
                                revision,
                                title: d.title,
                                visible: !d.is_public,
                                variant: d.variant_id ?? null,
                              }),
                            });
                            await refresh();
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {d.is_public ? 'Make internal' : 'Make public'}
                      </Button>
                    )}
                    {editable && (
                      <Button
                        variant="danger"
                        style={{ fontSize: '0.8rem', padding: '4px 8px', minHeight: 32 }}
                        disabled={busy}
                        aria-label={`Retire ${d.title}`}
                        title={`Retire "${d.title}"`}
                        onClick={() => handleDeleteDocument(d.id, d.title)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '16px 0', color: '#94a3b8', fontSize: '0.85rem' }}>
              No technical documents uploaded for this product yet.
            </div>
          )}

          {editable && (
            <form
              className="document-upload"
              style={{ marginTop: 16 }}
              onSubmit={async (e) => {
                e.preventDefault();
                if (!file) {
                  setError('Select or drop a PDF document first.');
                  return;
                }
                setBusy(true);
                setError('');
                try {
                  const form = new FormData();
                  form.set('file', file);
                  form.set('revision', String(revision));
                  form.set('title', title);
                  form.set('kind', kind);
                  form.set('visible', String(visible));
                  const response = await fetch(`/api/admin/products/${id}/documents`, {
                    method: 'POST',
                    body: form,
                  });
                  const result = await response.json();
                  if (!response.ok) throw new Error(result.error);
                  setFile(null);
                  setTitle('');
                  if (pdfInputRef.current) pdfInputRef.current.value = '';
                  await refresh();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingPdf(true);
                }}
                onDragLeave={() => setIsDraggingPdf(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingPdf(false);
                  const droppedFile = e.dataTransfer.files?.[0] ?? null;
                  handlePdfSelect(droppedFile);
                }}
                onClick={() => pdfInputRef.current?.click()}
                style={{
                  border: isDraggingPdf ? '2px dashed #2563eb' : '2px dashed #cbd5e1',
                  background: isDraggingPdf ? '#eff6ff' : '#f8fafc',
                  borderRadius: 10,
                  padding: '20px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  marginBottom: 16,
                }}
              >
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => handlePdfSelect(e.target.files?.[0] ?? null)}
                />
                {file ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                    }}
                  >
                    <FileText size={22} style={{ color: '#dc2626' }} />
                    <div style={{ textAlign: 'left' }}>
                      <strong style={{ fontSize: '0.88rem', display: 'block', color: '#0f172a' }}>
                        {file.name}
                      </strong>
                      <small style={{ color: '#64748b' }}>
                        {formatBytes(file.size)} · Click or drop another to replace
                      </small>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Upload size={22} style={{ color: '#64748b' }} />
                    <p
                      style={{ margin: 0, fontWeight: 500, fontSize: '0.85rem', color: '#1e293b' }}
                    >
                      Drag and drop PDF document here, or{' '}
                      <span style={{ color: '#2563eb', textDecoration: 'underline' }}>browse</span>
                    </p>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      Supported: Technical Data Sheets (TDS), Safety Data (MSDS), OEKO-TEX, GOTS,
                      Manuals (up to 10 MB)
                    </span>
                  </div>
                )}
              </div>

              <div className="form-grid">
                <Field label="Document title">
                  <input
                    required
                    placeholder="e.g. Technical Data Sheet - 150D DTY"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </Field>
                <Field label="Document type">
                  <select value={kind} onChange={(e) => setKind(e.target.value)}>
                    {['catalogue', 'TDS', 'SDS', 'MSDS', 'certificate', 'manual', 'other'].map(
                      (k) => (
                        <option key={k}>{k}</option>
                      ),
                    )}
                  </select>
                </Field>
                <Field label="Storefront visibility">
                  <span className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={(e) => setVisible(e.target.checked)}
                    />
                    Allow public download by buyers when published
                  </span>
                </Field>
              </div>

              <div style={{ marginTop: 12 }}>
                <Button disabled={busy || !file} type="submit">
                  <Upload size={15} />
                  {busy ? 'Uploading document…' : 'Upload document'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </section>
      {editingDocument && (
        <Modal
          title="Edit document"
          description="Save the title, public visibility and SKU assignment for this draft."
          onClose={() => setEditingDocument(null)}
        >
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError('');
              try {
                await api(`/api/admin/documents/${editingDocument.id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({
                    product: id,
                    revision,
                    title: editingDocument.title,
                    visible: editingDocument.is_public,
                    variant: editingDocument.variant_id || null,
                  }),
                });
                setEditingDocument(null);
                await refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-body">
              {error && (
                <div className="alert" role="alert">
                  {error}
                </div>
              )}
              <Field label="Document title">
                <input
                  required
                  maxLength={255}
                  value={editingDocument.title}
                  onChange={(event) =>
                    setEditingDocument({ ...editingDocument, title: event.target.value })
                  }
                />
              </Field>
              <Field label="Document variant">
                <select
                  value={editingDocument.variant_id || ''}
                  onChange={(event) =>
                    setEditingDocument({
                      ...editingDocument,
                      variant_id: event.target.value || null,
                    })
                  }
                >
                  <option value="">All variants</option>
                  {variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.variant_name}
                    </option>
                  ))}
                </select>
              </Field>
              <label>
                <input
                  type="checkbox"
                  checked={editingDocument.is_public}
                  onChange={(event) =>
                    setEditingDocument({ ...editingDocument, is_public: event.target.checked })
                  }
                />{' '}
                Public when published
              </label>
            </div>
            <div className="form-footer">
              <Button disabled={busy} type="submit">
                {busy ? 'Saving…' : 'Save document'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
