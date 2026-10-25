'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Package,
  ArrowUpRight,
  RotateCcw,
  Copy,
  CheckCircle2,
  Archive,
  Trash2,
  X,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import type { Product } from '@ann/database';
import { Badge, Button } from '@ann/ui';
import { dhakaDate } from '@ann/domain';
import { api } from '@/lib/client';
import { DataGrid } from './data-grid';

export function Products() {
  const params = useSearchParams(),
    router = useRouter(),
    query = params.toString();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkFeedback, setBulkFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
    details?: string[];
  } | null>(null);

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
  const selectedCount = selectedIds.length;

  const update = (fields: Record<string, string>) => {
    const next = new URLSearchParams(query);
    Object.entries(fields).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    router.replace(`/products?${next}`, { scroll: false });
  };

  useEffect(() => {
    setRowSelection({});
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== (params.get('q') ?? '')) {
        const next = new URLSearchParams(params.toString());
        if (search) next.set('q', search);
        else next.delete('q');
        next.delete('page');
        router.replace(`/products?${next}`, { scroll: false });
      }
    }, 350);
    // A slow route transition must not be replaced by an older debounced search.
    const cancelOnNavigation = (event: MouseEvent) => {
      const link = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
      if (link && new URL(link.href).pathname !== '/products') clearTimeout(timer);
    };
    document.addEventListener('click', cancelOnNavigation, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', cancelOnNavigation, true);
    };
  }, [search, params, router]);

  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['products', query],
    queryFn: () => api<{ rows: Product[]; total: number }>(`/api/admin/products?${query}`),
  });

  const { data: categories } = useQuery({
    queryKey: ['lookup', 'categories'],
    queryFn: () =>
      api<{ rows: { id: string; name: string }[] }>('/api/admin/masters/categories?lookup=true'),
  });

  const { data: brands } = useQuery({
    queryKey: ['lookup', 'brands'],
    queryFn: () =>
      api<{ rows: { id: string; name: string }[] }>('/api/admin/masters/brands?lookup=true'),
  });

  const bulkMutation = useMutation({
    mutationFn: async (action: 'publish' | 'unpublish' | 'archive' | 'delete' | 'restore') => {
      if (!selectedIds.length) return;
      return api<{
        total: number;
        succeededCount: number;
        failedCount: number;
        succeeded: { id: string; name: string }[];
        failed: { id: string; name: string; reason: string }[];
      }>('/api/admin/products/bulk', {
        method: 'POST',
        body: JSON.stringify({ ids: selectedIds, action }),
      });
    },
    onSuccess: (res) => {
      if (!res) return;
      setRowSelection({});
      refetch();
      if (res.failedCount === 0) {
        setBulkFeedback({
          type: 'success',
          message: `Successfully updated ${res.succeededCount} product${res.succeededCount > 1 ? 's' : ''}.`,
        });
      } else if (res.succeededCount > 0) {
        setBulkFeedback({
          type: 'warning',
          message: `Updated ${res.succeededCount} of ${res.total} products. ${res.failedCount} failed requirements.`,
          details: res.failed.map((f) => `${f.name}: ${f.reason}`),
        });
      } else {
        setBulkFeedback({
          type: 'error',
          message: `Action failed for all ${res.total} selected products.`,
          details: res.failed.map((f) => `${f.name}: ${f.reason}`),
        });
      }
    },
    onError: (err: Error) => {
      setBulkFeedback({
        type: 'error',
        message: err.message,
      });
    },
  });

  const exportToCsv = (rowsToExport: Product[], filenamePrefix = 'ANN_Traders_Products') => {
    if (!rowsToExport.length) return;
    const categoryMap = new Map((categories?.rows ?? []).map((c) => [c.id, c.name]));
    const brandMap = new Map((brands?.rows ?? []).map((b) => [b.id, b.name]));

    const headers = [
      'Product Code',
      'Product Name',
      'Category',
      'Brand',
      'Status',
      'Featured',
      'Last Updated',
    ];

    const csvRows = [headers.join(',')];

    for (const p of rowsToExport) {
      const row = [
        `"${(p.product_code ?? '').replace(/"/g, '""')}"`,
        `"${(p.name ?? '').replace(/"/g, '""')}"`,
        `"${(categoryMap.get(p.primary_category_id ?? '') ?? '—').replace(/"/g, '""')}"`,
        `"${(brandMap.get(p.brand_id ?? '') ?? '—').replace(/"/g, '""')}"`,
        `"${p.deleted_at ? 'Deleted' : p.status}"`,
        `"${p.is_featured ? 'Yes' : 'No'}"`,
        `"${p.updated_at ? new Date(p.updated_at).toISOString().split('T')[0] : ''}"`,
      ];
      csvRows.push(row.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `${filenamePrefix}_${new Date().toISOString().split('T')[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const columns: ColumnDef<Product>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          ref={(el) => {
            if (el) el.indeterminate = table.getIsSomePageRowsSelected();
          }}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          aria-label="Select all products on page"
          style={{ cursor: 'pointer', verticalAlign: 'middle', width: 16, height: 16 }}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
          aria-label={`Select product ${row.original.name}`}
          style={{ cursor: 'pointer', verticalAlign: 'middle', width: 16, height: 16 }}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'name',
      header: 'Product',
      cell: ({ row }) => (
        <Link className="product-name" href={`/products/${row.original.id}`}>
          <span className="product-placeholder">
            <Package size={19} />
          </span>
          <span>
            <strong>{row.original.name}</strong>
            <small>{row.original.product_code}</small>
          </span>
        </Link>
      ),
    },
    { accessorKey: 'product_code', header: 'Product code' },
    {
      accessorKey: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => (
        <Badge status={row.original.deleted_at ? 'archived' : row.original.status}>
          {row.original.deleted_at ? 'Deleted' : row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'is_featured',
      header: 'Featured',
      enableSorting: false,
      cell: ({ getValue }) => (getValue() ? 'Yes' : '—'),
    },
    {
      accessorKey: 'updated_at',
      header: 'Last updated',
      cell: ({ getValue }) => <span className="muted">{dhakaDate(String(getValue()))}</span>,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
          <button
            aria-label={`Duplicate ${row.original.name}`}
            title="Duplicate product as draft"
            className="icon-button"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!window.confirm(`Duplicate "${row.original.name}" as a new draft?`)) return;
              try {
                const res = await api<{ id: string }>(
                  `/api/admin/products/${row.original.id}/duplicate`,
                  { method: 'POST' },
                );
                router.push(`/products/${res.id}`);
              } catch (err) {
                alert((err as Error).message);
              }
            }}
          >
            <Copy size={16} />
          </button>
          <Link
            aria-label={`Open ${row.original.name}`}
            href={`/products/${row.original.id}`}
            className="icon-button"
          >
            <ArrowUpRight size={17} />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR CATALOG</span>
          <h1>
            Products<span className="count-pill">{data?.total ?? '—'}</span>
          </h1>
          <p>Manage the details that make every product distinct.</p>
        </div>
        <Link className="btn btn-primary" href="/products/new">
          <Plus size={16} />
          Add product
        </Link>
      </div>
      <section className="panel">
        <div className="tabs">
          {[
            ['', 'All products'],
            ['published', 'Published'],
            ['draft', 'Drafts'],
            ['archived', 'Archived'],
            ['deleted', 'Trash'],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => update({ status: value, page: '' })}
              className={(params.get('status') ?? '') === value ? 'tab active' : 'tab'}
            >
              {label}
            </button>
          ))}
        </div>

        {bulkFeedback && (
          <div
            className="alert"
            role="alert"
            style={{
              margin: '12px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              background:
                bulkFeedback.type === 'success'
                  ? '#ecfdf5'
                  : bulkFeedback.type === 'warning'
                    ? '#fefce8'
                    : '#fef2f2',
              color:
                bulkFeedback.type === 'success'
                  ? '#065f46'
                  : bulkFeedback.type === 'warning'
                    ? '#854d0e'
                    : '#991b1b',
              border: `1px solid ${
                bulkFeedback.type === 'success'
                  ? '#a7f3d0'
                  : bulkFeedback.type === 'warning'
                    ? '#fef08a'
                    : '#fecaca'
              }`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{bulkFeedback.message}</strong>
              <button
                type="button"
                className="icon-button"
                onClick={() => setBulkFeedback(null)}
                style={{ padding: 2, height: 'auto', minHeight: 'unset' }}
              >
                <X size={15} />
              </button>
            </div>
            {bulkFeedback.details && bulkFeedback.details.length > 0 && (
              <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '0.8rem' }}>
                {bulkFeedback.details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {selectedCount > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 8,
              margin: '12px 0',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  borderRadius: 9999,
                  minWidth: 22,
                  height: 22,
                  padding: '0 6px',
                }}
              >
                {selectedCount}
              </span>
              <strong style={{ fontSize: '0.85rem', color: '#1e3a8a' }}>
                {selectedCount} product{selectedCount > 1 ? 's' : ''} selected
              </strong>
            </div>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {params.get('status') !== 'published' && (
                <Button
                  variant="default"
                  style={{
                    background: '#16a34a',
                    borderColor: '#16a34a',
                    minHeight: 30,
                    fontSize: '0.78rem',
                    padding: '3px 10px',
                    display: 'flex',
                    gap: 5,
                    alignItems: 'center',
                  }}
                  disabled={bulkMutation.isPending}
                  onClick={() => bulkMutation.mutate('publish')}
                >
                  <CheckCircle2 size={13} /> Publish
                </Button>
              )}

              {params.get('status') !== 'draft' && (
                <Button
                  variant="outline"
                  style={{ minHeight: 30, fontSize: '0.78rem', padding: '3px 10px' }}
                  disabled={bulkMutation.isPending}
                  onClick={() => bulkMutation.mutate('unpublish')}
                >
                  Draft
                </Button>
              )}

              {params.get('status') !== 'archived' && (
                <Button
                  variant="outline"
                  style={{
                    minHeight: 30,
                    fontSize: '0.78rem',
                    padding: '3px 10px',
                    display: 'flex',
                    gap: 5,
                    alignItems: 'center',
                  }}
                  disabled={bulkMutation.isPending}
                  onClick={() => bulkMutation.mutate('archive')}
                >
                  <Archive size={13} /> Archive
                </Button>
              )}

              {params.get('status') === 'deleted' ? (
                <Button
                  variant="outline"
                  style={{
                    minHeight: 30,
                    fontSize: '0.78rem',
                    padding: '3px 10px',
                    display: 'flex',
                    gap: 5,
                    alignItems: 'center',
                  }}
                  disabled={bulkMutation.isPending}
                  onClick={() => bulkMutation.mutate('restore')}
                >
                  <RotateCcw size={13} /> Restore
                </Button>
              ) : (
                <Button
                  variant="danger"
                  style={{
                    minHeight: 30,
                    fontSize: '0.78rem',
                    padding: '3px 10px',
                    display: 'flex',
                    gap: 5,
                    alignItems: 'center',
                  }}
                  disabled={bulkMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Move ${selectedCount} product(s) to trash?`)) {
                      bulkMutation.mutate('delete');
                    }
                  }}
                >
                  <Trash2 size={13} /> Move to Trash
                </Button>
              )}

              <Button
                variant="outline"
                style={{
                  minHeight: 30,
                  fontSize: '0.78rem',
                  padding: '3px 10px',
                  display: 'flex',
                  gap: 5,
                  alignItems: 'center',
                }}
                onClick={() => {
                  const selectedRows = (data?.rows ?? []).filter((r) => rowSelection[r.id]);
                  exportToCsv(selectedRows, `ANN_Traders_Selected_${selectedRows.length}_Products`);
                }}
              >
                <Download size={13} /> Export ({selectedCount})
              </Button>

              <Button
                variant="ghost"
                style={{
                  minHeight: 30,
                  fontSize: '0.78rem',
                  padding: '3px 8px',
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                }}
                onClick={() => setRowSelection({})}
              >
                <X size={13} /> Deselect
              </Button>
            </div>
          </div>
        )}

        <div className="table-toolbar">
          <div className="search-input">
            <Search size={16} />
            <input
              aria-label="Search products"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, code, SKU or model…"
            />
          </div>
          <select
            aria-label="Category filter"
            value={params.get('category') ?? ''}
            onChange={(e) => update({ category: e.target.value, page: '' })}
          >
            <option value="">All categories</option>
            {categories?.rows.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Brand filter"
            value={params.get('brand') ?? ''}
            onChange={(e) => update({ brand: e.target.value, page: '' })}
          >
            <option value="">All brands</option>
            {brands?.rows.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            title="Export page to CSV"
            style={{
              minHeight: 38,
              padding: '0 12px',
              fontSize: '0.8rem',
              display: 'flex',
              gap: 6,
              alignItems: 'center',
            }}
            onClick={() => {
              if (!data?.rows.length) return;
              exportToCsv(data.rows, `ANN_Traders_Catalog_Page_${params.get('page') ?? '1'}`);
            }}
          >
            <FileSpreadsheet size={15} />
            Export CSV
          </Button>
          <Button variant="outline" aria-label="Refresh products" onClick={() => refetch()}>
            <RotateCcw size={15} />
          </Button>
        </div>
        {error ? (
          <div className="alert" role="alert">
            {error.message}
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <DataGrid
            rows={data?.rows ?? []}
            columns={columns}
            total={data?.total ?? 0}
            page={Number(params.get('page') ?? 1)}
            onPage={(n) => update({ page: String(n) })}
            loading={isPending}
            sort={[{ id: params.get('sort') ?? 'updated_at', desc: params.get('asc') !== 'true' }]}
            onSort={(key, ascending) => update({ sort: key, asc: String(ascending), page: '' })}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            getRowId={(row) => row.id}
          />
        )}
      </section>
    </>
  );
}
