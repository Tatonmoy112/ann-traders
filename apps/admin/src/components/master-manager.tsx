'use client';
import Image from 'next/image';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, FolderTree, Table } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { masters } from '@ann/database';
import { Button, Modal, Badge } from '@ann/ui';
import { api } from '@/lib/client';
import { RecordFields, defaults, type Row } from './record-form';
import { DataGrid } from './data-grid';
import { CategoryTree } from './category-tree';
export function MasterManager({ table, canEdit }: { table: string; canEdit: boolean }) {
  const config = masters[table],
    client = useQueryClient();
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(''),
    [editing, setEditing] = useState<Row | null>(null),
    [values, setValues] = useState<Row>({}),
    [viewMode, setViewMode] = useState<'tree' | 'table'>('tree');
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['masters', table, page, search],
    queryFn: () =>
      api<{ rows: Row[]; total: number }>(
        `/api/admin/masters/${table}?${new URLSearchParams({ page: String(page), q: search })}`,
      ),
  });
  const { data: allCategories } = useQuery({
    queryKey: ['masters', 'categories', 'all'],
    queryFn: () => api<{ rows: Row[]; total: number }>('/api/admin/masters/categories?lookup=true'),
    enabled: table === 'categories',
  });
  const save = useMutation({
    mutationFn: () =>
      api(`/api/admin/masters/${table}`, {
        method: 'POST',
        body: JSON.stringify({ id: editing?.id ?? undefined, values }),
      }),
    onSuccess: async () => {
      setEditing(null);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['masters', table] }),
        client.invalidateQueries({ queryKey: ['lookup', table] }),
        client.invalidateQueries({ queryKey: ['masters', 'categories', 'all'] }),
      ]);
    },
  });
  const columns: ColumnDef<Row>[] = [
    ...config.fields
      .filter((f) => !['textarea', 'boolean'].includes(f.type ?? '') && !f.lookup)
      .slice(0, 4)
      .map((f) => ({
        accessorKey: f.key,
        header: f.label,
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const val = getValue();
          if (f.type === 'image') {
            return val ? (
              <Image
                unoptimized
                width={32}
                height={32}
                src={String(val)}
                alt={f.label}
                style={{
                  width: 32,
                  height: 32,
                  objectFit: 'contain',
                  borderRadius: 4,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'inline-block',
                  verticalAlign: 'middle',
                }}
              />
            ) : (
              <span className="muted">—</span>
            );
          }
          return <span className={f.key === 'name' ? 'row-title' : ''}>{String(val ?? '—')}</span>;
        },
      })),
    ...(config.fields.some((f) => f.key === 'is_active')
      ? [
          {
            accessorKey: 'is_active',
            header: 'Status',
            cell: ({ getValue }: { getValue: () => unknown }) => (
              <Badge status={getValue() ? 'published' : 'archived'}>
                {getValue() ? 'Active' : 'Inactive'}
              </Badge>
            ),
          },
        ]
      : []),
    ...(canEdit
      ? [
          {
            id: 'edit',
            header: '',
            cell: ({ row }: { row: { original: Row } }) => (
              <Button
                variant="ghost"
                aria-label={`Edit ${config.singular}`}
                onClick={() => {
                  save.reset();
                  setEditing(row.original);
                  setValues(
                    Object.fromEntries(
                      config.fields.map((f) => [f.key, row.original[f.key] ?? null]),
                    ),
                  );
                }}
              >
                <Pencil size={15} />
              </Button>
            ),
          },
        ]
      : []),
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CATALOG STRUCTURE</span>
          <h1>{config.title}</h1>
          <p>{config.description}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {table === 'categories' && (
            <div
              style={{
                display: 'inline-flex',
                background: '#eef2f6',
                borderRadius: 8,
                padding: 3,
                gap: 3,
              }}
            >
              <Button
                variant={viewMode === 'tree' ? 'default' : 'ghost'}
                onClick={() => setViewMode('tree')}
                style={{ minHeight: 32, padding: '4px 10px', fontSize: '0.8rem' }}
              >
                <FolderTree size={14} /> Tree
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                onClick={() => setViewMode('table')}
                style={{ minHeight: 32, padding: '4px 10px', fontSize: '0.8rem' }}
              >
                <Table size={14} /> Table
              </Button>
            </div>
          )}
          {canEdit && (
            <Button
              onClick={() => {
                save.reset();
                setEditing({});
                setValues(defaults(config.fields));
              }}
            >
              <Plus size={16} />
              Add {config.singular}
            </Button>
          )}
        </div>
      </div>
      <section className="panel">
        <div className="table-toolbar">
          <label className="field">
            Search {config.title}
            <input
              value={search}
              maxLength={100}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
                setViewMode('table');
              }}
            />
          </label>
        </div>
        {error ? (
          <div className="alert" role="alert">
            {error.message}
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : table === 'categories' && viewMode === 'tree' ? (
          <CategoryTree
            categories={allCategories?.rows ?? []}
            canEdit={canEdit}
            onEdit={(cat) => {
              save.reset();
              setEditing(cat);
              setValues(Object.fromEntries(config.fields.map((f) => [f.key, cat[f.key] ?? null])));
            }}
            onAddChild={(parent) => {
              save.reset();
              setEditing({});
              const initial = defaults(config.fields);
              initial.parent_id = parent.id;
              setValues(initial);
            }}
          />
        ) : (
          <DataGrid
            rows={data?.rows ?? []}
            total={data?.total ?? 0}
            columns={columns}
            page={page}
            onPage={setPage}
            loading={isPending}
          />
        )}
      </section>
      {editing && (
        <Modal
          title={`${editing.id ? 'Edit' : 'Add'} ${config.singular}`}
          description={config.description}
          onClose={() => setEditing(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="form-body">
              {save.error && (
                <div className="alert" role="alert">
                  {save.error.message}
                </div>
              )}
              <RecordFields fields={config.fields} value={values} onChange={setValues} />
            </div>
            <div className="form-footer">
              <Button variant="outline" type="button" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button disabled={save.isPending} type="submit">
                {save.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
