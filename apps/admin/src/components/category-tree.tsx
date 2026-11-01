'use client';
import Image from 'next/image';
import { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
  Pencil,
  Search,
  Layers,
} from 'lucide-react';
import { Badge, Button } from '@ann/ui';
import type { Row } from './record-form';

interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
  image_path: string | null;
  requires_composition: boolean;
  is_active: boolean;
  raw: Row;
  children: CategoryNode[];
}

export function CategoryTree({
  categories,
  onEdit,
  onAddChild,
  canEdit,
}: {
  categories: Row[];
  onEdit: (cat: Row) => void;
  onAddChild: (parent: Row) => void;
  canEdit: boolean;
}) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // 1. Build tree structure
  const rootNodes = useMemo(() => {
    const nodeMap = new Map<string, CategoryNode>();
    const roots: CategoryNode[] = [];

    categories.forEach((cat) => {
      nodeMap.set(String(cat.id), {
        id: String(cat.id ?? ''),
        name: String(cat.name ?? ''),
        slug: String(cat.slug ?? ''),
        parent_id: cat.parent_id ? String(cat.parent_id) : null,
        sort_order: Number(cat.sort_order ?? 0),
        image_path: cat.image_path ? String(cat.image_path) : null,
        requires_composition: Boolean(cat.requires_composition),
        is_active: cat.is_active !== false,
        raw: cat,
        children: [],
      });
    });

    categories.forEach((cat) => {
      const node = nodeMap.get(String(cat.id))!;
      const parentId = cat.parent_id ? String(cat.parent_id) : null;
      if (parentId && nodeMap.has(parentId)) {
        nodeMap.get(parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    const sortFn = (a: CategoryNode, b: CategoryNode) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.name.localeCompare(b.name);
    };

    const sortRec = (nodes: CategoryNode[]) => {
      nodes.sort(sortFn);
      nodes.forEach((n) => sortRec(n.children));
    };

    sortRec(roots);
    return roots;
  }, [categories]);

  // Expand / collapse helpers
  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    categories.forEach((c) => {
      next[String(c.id)] = true;
    });
    setExpanded(next);
  };

  const collapseAll = () => {
    setExpanded({});
  };

  // Render a tree node recursively
  const renderNode = (node: CategoryNode, depth = 0): React.ReactNode => {
    const id = String(node.id);
    const hasChildren = node.children.length > 0;
    const isSearching = search.trim().length > 0;
    const matchesSearch = String(node.name ?? '')
      .toLowerCase()
      .includes(search.toLowerCase());

    const isExpanded = isSearching ? true : (expanded[id] ?? depth < 1);

    return (
      <div key={id} style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            paddingLeft: `${16 + depth * 28}px`,
            borderBottom: '1px solid #f1f5f9',
            background: matchesSearch && isSearching ? '#fef9c3' : '#ffffff',
            transition: 'background 0.15s ease',
            borderRadius: 6,
          }}
        >
          {/* Left: Caret + Icon + Title + Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleExpand(id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                  color: '#64748b',
                }}
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            ) : (
              <span style={{ width: 16, display: 'inline-block' }} />
            )}

            {/* Thumbnail or Folder Icon */}
            {node.image_path ? (
              <Image
                unoptimized
                width={24}
                height={24}
                src={String(node.image_path)}
                alt={String(node.name)}
                style={{
                  width: 24,
                  height: 24,
                  objectFit: 'contain',
                  borderRadius: 4,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                }}
              />
            ) : hasChildren ? (
              isExpanded ? (
                <FolderOpen size={18} style={{ color: '#2563eb', flexShrink: 0 }} />
              ) : (
                <Folder size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
              )
            ) : (
              <Layers size={17} style={{ color: '#94a3b8', flexShrink: 0 }} />
            )}

            {/* Name & Slug */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
              <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{String(node.name)}</strong>
              <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>/{String(node.slug)}</small>
            </div>

            {/* Tags & Badges */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 8 }}>
              {hasChildren && (
                <span
                  style={{
                    background: '#f1f5f9',
                    color: '#475569',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: 9999,
                  }}
                >
                  {node.children.length} subcategories
                </span>
              )}
              {Boolean(node.requires_composition) && (
                <span
                  style={{
                    background: '#ecfdf5',
                    color: '#059669',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: 9999,
                    border: '1px solid #a7f3d0',
                  }}
                  title="Products in this category enforce a strict 100% fiber composition sum"
                >
                  100% Fiber
                </span>
              )}
              <Badge status={node.is_active ? 'published' : 'archived'}>
                {node.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>

          {/* Right: Actions */}
          {canEdit && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <Button
                variant="ghost"
                aria-label={`Add subcategory under ${node.name}`}
                title={`Add subcategory under "${node.name}"`}
                onClick={() => onAddChild(node.raw)}
                style={{ fontSize: '0.75rem', padding: '4px 8px', display: 'flex', gap: 4 }}
              >
                <Plus size={14} />
                Subcategory
              </Button>
              <Button
                variant="ghost"
                aria-label={`Edit ${node.name}`}
                title={`Edit "${node.name}"`}
                onClick={() => onEdit(node.raw)}
              >
                <Pencil size={14} />
              </Button>
            </div>
          )}
        </div>

        {/* Children Render */}
        {hasChildren && isExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Search & Collapse Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          background: '#f8fafc',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 360 }}>
          <Search size={15} style={{ color: '#94a3b8' }} />
          <input
            placeholder="Search hierarchy..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '0.85rem',
              width: '100%',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="btn btn-outline"
            style={{ fontSize: '0.75rem', padding: '3px 8px' }}
            onClick={expandAll}
          >
            Expand All
          </button>
          <button
            type="button"
            className="btn btn-outline"
            style={{ fontSize: '0.75rem', padding: '3px 8px' }}
            onClick={collapseAll}
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Tree Rows */}
      <div
        style={{
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          overflow: 'hidden',
        }}
      >
        {rootNodes.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
            No categories defined yet.
          </div>
        ) : (
          rootNodes.map((root) => renderNode(root, 0))
        )}
      </div>
    </div>
  );
}
