'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { relations } from '@ann/database';
import { Button, Modal } from '@ann/ui';
import { api } from '@/lib/client';
import { RecordFields, defaults, type Row } from './record-form';
export function RelationEditor({
  id,
  revision,
  table,
  localChoices,
  onSaved,
  categoryId,
}: {
  id: string;
  revision: number;
  table: string;
  localChoices: Record<string, Row[]>;
  onSaved: () => void;
  categoryId?: string | null;
}) {
  const [editing, setEditing] = useState<Row[] | null>(null),
    client = useQueryClient(),
    config = relations[table];
  const specification = table.endsWith('attribute_values');
  const definitions = useQuery({
    queryKey: ['lookup', 'attribute_definitions'],
    queryFn: () => api<{ rows: Row[] }>('/api/admin/masters/attribute_definitions?lookup=true'),
    enabled: specification,
  });
  const options = useQuery({
    queryKey: ['lookup', 'attribute_options'],
    queryFn: () => api<{ rows: Row[] }>('/api/admin/masters/attribute_options?lookup=true'),
    enabled: specification,
  });
  const mappings = useQuery({
    queryKey: ['category-specifications', categoryId],
    queryFn: () =>
      api<{ rows: Row[] }>(
        `/api/admin/masters/category_attributes?lookup=true&category=${categoryId}`,
      ),
    enabled: specification && Boolean(categoryId),
  });
  const applicable =
    mappings.data?.rows.filter(
      (r) => r.applies_to === (table.startsWith('variant_') ? 'variant' : 'product'),
    ) ?? [];
  const allowedDefinitions =
    definitions.data?.rows.filter(
      (d) =>
        d.is_active && (applicable.length === 0 || applicable.some((m) => m.attribute_id === d.id)),
    ) ?? [];
  const { data, error, isPending } = useQuery({
    queryKey: ['relation', id, table],
    queryFn: () => api<Row[]>(`/api/admin/products/${id}/relations/${table}`),
  });
  const mutation = useMutation({
    mutationFn: () =>
      api(`/api/admin/products/${id}/relations/${table}`, {
        method: 'PUT',
        body: JSON.stringify({
          revision,
          rows: editing?.map((row) => {
            const cleaned: Row = {};
            config.fields.forEach((f) => {
              cleaned[f.key] = row[f.key] ?? null;
            });
            if (
              ![
                'product_extra_categories',
                'product_industries',
                'product_applications',
                'variant_fiber_composition',
                'variant_equipment_compatibility',
              ].includes(table)
            )
              cleaned.id = row.id ?? crypto.randomUUID();
            if (table.startsWith('product_')) cleaned.product_id = id;
            return cleaned;
          }),
        }),
      }),
    onSuccess: async () => {
      setEditing(null);
      await client.invalidateQueries({ queryKey: ['relation', id, table] });
      onSaved();
    },
  });
  return (
    <section className="panel relation-card">
      <div className="panel-heading">
        <div>
          <h2>{config.title}</h2>
          <p>{config.description}</p>
        </div>
        <Button
          variant="outline"
          disabled={isPending || Boolean(error)}
          onClick={() => {
            mutation.reset();
            setEditing((data ?? []).map((v) => ({ ...v })));
          }}
        >
          Edit <span className="count-pill">{data?.length ?? 0}</span>
        </Button>
      </div>
      {error && <div className="alert">{error.message}</div>}
      {Boolean(data?.length) && (
        <div className="relation-preview">
          {data?.slice(0, 3).map((row, i) => (
            <span key={i}>
              {config.fields
                .filter((f) => row[f.key] !== null)
                .slice(0, 2)
                .map((f) => {
                  const value = row[f.key];
                  const option = f.lookup
                    ? localChoices[f.lookup]?.find((x) => x.id === value)
                    : null;
                  return `${f.label}: ${option ? (option.name ?? option.variant_name ?? option.model_name ?? option.label) : value}`;
                })
                .join(' · ')}
            </span>
          ))}
        </div>
      )}
      {editing && (
        <Modal
          title={config.title}
          description="Changes are saved atomically to this draft. Other sections should be saved before continuing."
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
              {editing.map((row, index) => (
                <div className="relation-row" key={index}>
                  <div className="relation-row-heading">
                    <strong>
                      {config.singular} {index + 1}
                    </strong>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`Remove row ${index + 1}`}
                      onClick={() => setEditing(editing.filter((_, i) => i !== index))}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                  <RecordFields
                    fields={config.fields
                      .filter((f) => {
                        if (!specification) return true;
                        const definition = definitions.data?.rows.find(
                          (d) => d.id === row.attribute_id,
                        );
                        const key =
                          definition?.data_type === 'number'
                            ? 'value_number'
                            : definition?.data_type === 'text'
                              ? 'value_text'
                              : definition?.data_type === 'boolean'
                                ? 'value_boolean'
                                : definition?.data_type === 'select' ||
                                    definition?.data_type === 'multi_select'
                                  ? 'option_id'
                                  : null;
                        if (
                          ['value_number', 'value_text', 'value_boolean', 'option_id'].includes(
                            f.key,
                          )
                        )
                          return f.key === key;
                        return f.key !== 'unit_id' || definition?.data_type === 'number';
                      })
                      .map((f) =>
                        specification &&
                        ['value_number', 'value_text', 'value_boolean', 'option_id'].includes(f.key)
                          ? { ...f, required: true }
                          : f,
                      )}
                    value={row}
                    localChoices={
                      specification
                        ? {
                            ...localChoices,
                            attribute_definitions: allowedDefinitions,
                            attribute_options:
                              options.data?.rows.filter(
                                (o) => o.attribute_id === row.attribute_id && o.is_active,
                              ) ?? [],
                          }
                        : localChoices
                    }
                    onChange={(next) => {
                      if (specification && next.attribute_id !== row.attribute_id) {
                        const definition = definitions.data?.rows.find(
                          (d) => d.id === next.attribute_id,
                        );
                        next = {
                          ...next,
                          option_id: null,
                          value_text: null,
                          value_number: null,
                          value_boolean: null,
                          unit_id: definition?.default_unit_id ?? null,
                        };
                      }
                      setEditing(editing.map((r, i) => (i === index ? next : r)));
                    }}
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing([...editing, defaults(config.fields)])}
              >
                <Plus size={15} />
                Add {config.singular}
              </Button>
            </div>
            <div className="form-footer">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving…' : 'Save relationships'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
