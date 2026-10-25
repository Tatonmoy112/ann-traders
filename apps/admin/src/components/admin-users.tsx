'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Pencil } from 'lucide-react';
import { Button, Badge, Modal, Field } from '@ann/ui';
import type { Profile } from '@ann/database';
import { api } from '@/lib/client';
import { DataGrid } from './data-grid';
export function AdminUsers() {
  const client = useQueryClient(),
    [page, setPage] = useState(1),
    [editing, setEditing] = useState<Partial<Profile> | null>(null),
    [email, setEmail] = useState('');
  const query = useQuery({
    queryKey: ['admin-users', page],
    queryFn: () => api<{ rows: Profile[]; total: number }>(`/api/admin/users?page=${page}`),
  });
  const mutation = useMutation({
    mutationFn: () =>
      api('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ ...editing, email: editing?.id ? undefined : email }),
      }),
    onSuccess: async () => {
      setEditing(null);
      await client.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ACCESS MANAGEMENT</span>
          <h1>Administrators</h1>
          <p>Invite your team and assign the access they need.</p>
        </div>
        <Button
          onClick={() => {
            mutation.reset();
            setEmail('');
            setEditing({ full_name: '', role: 'editor', is_active: true });
          }}
        >
          <UserPlus size={16} />
          Invite administrator
        </Button>
      </div>
      {query.error && (
        <div className="alert" role="alert">
          {query.error.message}
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
            { accessorKey: 'full_name', header: 'Full name' },
            {
              accessorKey: 'role',
              header: 'Role',
              cell: ({ getValue }) => String(getValue()).replace('_', ' '),
            },
            {
              accessorKey: 'is_active',
              header: 'Status',
              cell: ({ getValue }) => (
                <Badge status={getValue() ? 'published' : 'archived'}>
                  {getValue() ? 'Active' : 'Disabled'}
                </Badge>
              ),
            },
            {
              id: 'edit',
              header: '',
              cell: ({ row }) => (
                <Button
                  variant="ghost"
                  aria-label="Edit administrator"
                  onClick={() => {
                    mutation.reset();
                    setEditing(row.original);
                  }}
                >
                  <Pencil size={15} />
                </Button>
              ),
            },
          ]}
        />
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Permission guide</h2>
            <p>Every role is enforced in the application and database.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Capability</th>
                <th>Editor</th>
                <th>Admin</th>
                <th>Super admin</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Edit drafts, variants & assets', 'Yes', 'Yes', 'Yes'],
                ['Publish and manage lifecycle', '—', 'Yes', 'Yes'],
                ['Manage catalog dictionaries', 'Read', 'Yes', 'Yes'],
                ['View activity log', '—', 'Yes', 'Yes'],
                ['Invite and manage administrators', '—', '—', 'Yes'],
                ['Authenticator required', 'Optional', 'Required', 'Required'],
              ].map((row) => (
                <tr key={row[0]}>
                  {row.map((v, i) => (
                    <td key={i}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {editing && (
        <Modal
          title={editing.id ? 'Edit administrator' : 'Invite administrator'}
          description="Only super administrators can manage access. You cannot change your own role or activation state."
          onClose={() => setEditing(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <div className="form-body">
              {mutation.error && (
                <div className="alert" role="alert">
                  {mutation.error.message}
                </div>
              )}
              {!editing.id && (
                <Field label="Email address">
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
              )}
              <Field label="Full name">
                <input
                  required
                  minLength={2}
                  value={editing.full_name ?? ''}
                  onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
                />
              </Field>
              <Field label="Role">
                <select
                  value={editing.role}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                >
                  {['editor', 'admin', 'super_admin'].map((r) => (
                    <option key={r} value={r}>
                      {r.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={editing.is_active ?? true}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                />
                Account active
              </label>
            </div>
            <div className="form-footer">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving…' : editing.id ? 'Save access' : 'Send invitation'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
