'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, ArrowUpRight, Download } from 'lucide-react';
import { Badge, Button, Modal } from '@ann/ui';
import { dhakaDate } from '@ann/domain';
import { api } from '@/lib/client';
import { DataGrid } from './data-grid';
type LibraryRow = {
  id: string;
  product_id: string;
  title?: string;
  document_type?: string;
  is_public?: boolean;
  delivery_url?: string | null;
  alt_text?: string | null;
  upload_status?: string;
  object_manifest?: { kind: string; url: string }[];
  created_at: string;
};
export function Library({ kind }: { kind: 'media' | 'documents' }) {
  const [page, setPage] = useState(1),
    [error, setError] = useState('');
  const query = useQuery({
    queryKey: ['library', kind, page],
    queryFn: () =>
      api<{ rows: LibraryRow[]; total: number }>(`/api/admin/library?kind=${kind}&page=${page}`),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CATALOG ASSETS</span>
          <h1>{kind === 'media' ? 'Media library' : 'Technical documents'}</h1>
          <p>
            {kind === 'media'
              ? 'Verified imagery and upload status across the catalog.'
              : 'Product specifications, safety data, and supporting documentation.'}{' '}
            Add assets from the product editor.
          </p>
        </div>
      </div>
      {(query.error || error) && (
        <div className="alert" role="alert">
          {query.error?.message || error}
        </div>
      )}
      <section className="panel">
        <DataGrid
          rows={query.data?.rows ?? []}
          total={query.data?.total ?? 0}
          page={page}
          onPage={setPage}
          loading={query.isPending}
          columns={[
            {
              id: 'asset',
              header: kind === 'media' ? 'Image' : 'Document',
              cell: ({ row }) =>
                kind === 'media' ? (
                  <div className="product-name">
                    {row.original.delivery_url ? (
                      <Image
                        unoptimized
                        src={
                          row.original.object_manifest?.find((v) => v.kind === 'thumbnail')?.url ??
                          row.original.delivery_url
                        }
                        alt={row.original.alt_text ?? 'Catalog image'}
                        width={60}
                        height={45}
                        style={{ objectFit: 'contain' }}
                      />
                    ) : (
                      <FileText size={20} />
                    )}
                    <small>{row.original.id.slice(0, 8)}</small>
                  </div>
                ) : (
                  <div className="product-name">
                    <FileText size={19} />
                    <strong>{row.original.title}</strong>
                  </div>
                ),
            },
            {
              id: 'state',
              header: 'Status',
              cell: ({ row }) => (
                <Badge
                  status={
                    row.original.upload_status === 'ready' || row.original.is_public
                      ? 'published'
                      : 'draft'
                  }
                >
                  {kind === 'media'
                    ? row.original.upload_status
                    : row.original.is_public
                      ? 'Public when published'
                      : 'Private'}
                </Badge>
              ),
            },
            {
              accessorKey: 'created_at',
              header: 'Created',
              cell: ({ getValue }) => dhakaDate(String(getValue())),
            },
            {
              id: 'open',
              header: 'Product',
              cell: ({ row }) => (
                <Link className="text-link" href={`/products/${row.original.product_id}`}>
                  Open product <ArrowUpRight size={14} />
                </Link>
              ),
            },
            ...(kind === 'documents'
              ? [
                  {
                    id: 'actions',
                    header: '',
                    cell: ({ row }: { row: { original: LibraryRow } }) => (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <Button
                          variant="outline"
                          style={{ minHeight: 30, padding: '3px 8px', fontSize: '0.78rem' }}
                          onClick={async () => {
                            try {
                              const result = await api<{ url: string }>(
                                `/api/admin/documents/${row.original.id}`,
                              );
                              window.open(result.url, '_blank', 'noopener,noreferrer');
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        >
                          <Download size={13} /> Download
                        </Button>
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </section>
    </>
  );
}
export type AuditRow = {
  id: string;
  entity_name: string;
  entity_id: string;
  admin_id: string;
  action: string;
  created_at: string;
  old_data: unknown;
  new_data: unknown;
};
export function AuditDetail({ row }: { row: AuditRow }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Inspect
      </Button>
      {open && (
        <Modal
          title={`${row.action} · ${row.entity_name}`}
          description={`${dhakaDate(row.created_at)} · Actor ${row.admin_id}`}
          onClose={() => setOpen(false)}
        >
          <div className="form-body">
            <h3>Before</h3>
            <pre className="audit-json">{JSON.stringify(row.old_data, null, 2)}</pre>
            <h3>After</h3>
            <pre className="audit-json">{JSON.stringify(row.new_data, null, 2)}</pre>
          </div>
        </Modal>
      )}
    </>
  );
}
