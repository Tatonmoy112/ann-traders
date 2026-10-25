'use client';
import { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
  type OnChangeFn,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3 } from 'lucide-react';
import { Button } from '@ann/ui';
export function DataGrid<T>({
  rows,
  columns,
  total,
  page,
  onPage,
  onSort,
  sort,
  loading,
  rowSelection,
  onRowSelectionChange,
  getRowId,
}: {
  rows: T[];
  columns: ColumnDef<T>[];
  total: number;
  page: number;
  onPage: (n: number) => void;
  onSort?: (key: string, ascending: boolean) => void;
  sort?: SortingState;
  loading?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  getRowId?: (row: T) => string;
}) {
  const [visibility, setVisibility] = useState({}),
    [internalSelection, setInternalSelection] = useState<RowSelectionState>({}),
    [showColumns, setShowColumns] = useState(false);
  const selection = rowSelection !== undefined ? rowSelection : internalSelection;
  const handleSelectionChange = onRowSelectionChange ?? setInternalSelection;
  // This table is intentionally outside React Compiler memoization; TanStack exposes mutable getter APIs.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    state: { columnVisibility: visibility, rowSelection: selection, sorting: sort ?? [] },
    onColumnVisibilityChange: setVisibility,
    onRowSelectionChange: handleSelectionChange,
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sort ?? []) : updater;
      if (next[0]) onSort?.(next[0].id, !next[0].desc);
    },
  });
  return (
    <>
      <div className="grid-options">
        <span className="muted">{total.toLocaleString('en-BD')} records</span>
        <div className="column-picker">
          <button className="text-link" onClick={() => setShowColumns(!showColumns)}>
            <Columns3 size={14} />
            Columns
          </button>
          {showColumns && (
            <div className="column-menu">
              {table
                .getAllLeafColumns()
                .filter((c) => c.getCanHide())
                .map((c) => (
                  <label key={c.id}>
                    <input
                      type="checkbox"
                      checked={c.getIsVisible()}
                      onChange={c.getToggleVisibilityHandler()}
                    />
                    {typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id}
                  </label>
                ))}
            </div>
          )}
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((h) => (
                  <th key={h.id}>
                    {h.column.getCanSort() && onSort ? (
                      <button className="sort-button" onClick={h.column.getToggleSortingHandler()}>
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === 'asc' ? (
                          <ArrowUp size={12} />
                        ) : h.column.getIsSorted() === 'desc' ? (
                          <ArrowDown size={12} />
                        ) : null}
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    {table.getVisibleLeafColumns().map((c) => (
                      <td key={c.id}>
                        <div className="skeleton" />
                      </td>
                    ))}
                  </tr>
                ))
              : table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {!loading && !rows.length && (
        <div className="empty-state">
          <h3>No records to show</h3>
          <p>Create a record or adjust your filters.</p>
        </div>
      )}
      <div className="pagination">
        <span>
          Page {page} of {Math.max(1, Math.ceil(total / 20))}
        </span>
        <div>
          <Button
            variant="outline"
            aria-label="Previous page"
            disabled={page <= 1 || loading}
            onClick={() => onPage(page - 1)}
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            variant="outline"
            aria-label="Next page"
            disabled={page * 20 >= total || loading}
            onClick={() => onPage(page + 1)}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </>
  );
}
