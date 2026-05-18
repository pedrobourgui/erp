"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Download,
  Loader2,
  Inbox,
} from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ──────────────────────────────────────────────────────────────

export interface ColumnDef<T> {
  id: string;
  header: string;
  accessor?: keyof T | ((row: T) => unknown);
  cell?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

export interface PaginationState {
  page: number;
  limit: number;
  total: number;
}

export interface SortState {
  column: string;
  direction: "asc" | "desc";
}

export interface BulkAction {
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  onClick: (selectedIds: string[]) => void;
}

export interface DataTableProps<T extends { id: string }> {
  columns: ColumnDef<T>[];
  data: T[];
  pagination: PaginationState;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  sort?: SortState | null;
  onSortChange?: (sort: SortState) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  selectable?: boolean;
  bulkActions?: BulkAction[];
  exportCsv?: boolean;
  onExportCsv?: () => void;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
  toolbar?: React.ReactNode;
}

// ─── Skeleton ───────────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="p-4">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
        </td>
      ))}
    </tr>
  );
}

// ─── Component ──────────────────────────────────────────────────────────

export function DataTable<T extends { id: string }>({
  columns,
  data,
  pagination,
  onPageChange,
  onLimitChange,
  sort,
  onSortChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  selectable = false,
  bulkActions = [],
  exportCsv = false,
  onExportCsv,
  isLoading = false,
  emptyMessage = "Nenhum registro encontrado",
  emptyDescription = "Tente ajustar os filtros ou criar um novo registro.",
  toolbar,
}: DataTableProps<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [localSearch, setLocalSearch] = useState(searchValue ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external search value
  useEffect(() => {
    if (searchValue !== undefined) {
      setLocalSearch(searchValue);
    }
  }, [searchValue]);

  // Debounced search
  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value);
      if (onSearchChange) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          onSearchChange(value);
        }, 300);
      }
    },
    [onSearchChange]
  );

  // Cleanup debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Selection
  const allSelected =
    data.length > 0 && data.every((row) => selectedIds.has(row.id));
  const someSelected =
    data.some((row) => selectedIds.has(row.id)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.map((row) => row.id)));
    }
  };

  const toggleRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Sort
  const handleSort = (columnId: string) => {
    if (!onSortChange) return;
    if (sort?.column === columnId) {
      onSortChange({
        column: columnId,
        direction: sort.direction === "asc" ? "desc" : "asc",
      });
    } else {
      onSortChange({ column: columnId, direction: "asc" });
    }
  };

  // Pagination helpers
  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1;
  const startRecord = (pagination.page - 1) * pagination.limit + 1;
  const endRecord = Math.min(
    pagination.page * pagination.limit,
    pagination.total
  );

  // Get cell value
  const getCellValue = (row: T, col: ColumnDef<T>): React.ReactNode => {
    if (col.cell) return col.cell(row, 0);
    if (col.accessor) {
      if (typeof col.accessor === "function") {
        return String(col.accessor(row) ?? "");
      }
      return String((row as Record<string, unknown>)[col.accessor as string] ?? "");
    }
    return "";
  };

  // Default CSV export
  const handleExportCsv = () => {
    if (onExportCsv) {
      onExportCsv();
      return;
    }
    const headers = columns.map((c) => c.header);
    const rows = data.map((row) =>
      columns.map((col) => {
        if (col.accessor) {
          const val =
            typeof col.accessor === "function"
              ? col.accessor(row)
              : (row as Record<string, unknown>)[col.accessor as string];
          return String(val ?? "");
        }
        return "";
      })
    );
    const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedArray = Array.from(selectedIds);
  const colCount = columns.length + (selectable ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          {onSearchChange && (
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={localSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9"
              />
            </div>
          )}
          {toolbar}
        </div>
        <div className="flex items-center gap-2">
          {exportCsv && (
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          )}
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectable && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">
            {selectedIds.size} selecionado{selectedIds.size > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            {bulkActions.map((action) => (
              <Button
                key={action.label}
                variant={(action.variant as "default") ?? "outline"}
                size="sm"
                onClick={() => action.onClick(selectedArray)}
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto"
          >
            Limpar seleção
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                {selectable && (
                  <th className="w-12 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className={cn(
                      "px-4 py-3 text-left font-medium text-muted-foreground",
                      col.sortable && "cursor-pointer select-none",
                      col.headerClassName
                    )}
                    onClick={col.sortable ? () => handleSort(col.id) : undefined}
                  >
                    <div className={cn(
                      "flex items-center gap-1",
                      col.headerClassName?.includes("text-right") && "justify-end"
                    )}>
                      {col.header}
                      {col.sortable && (
                        <span className="ml-1">
                          {sort?.column === col.id ? (
                            sort.direction === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: pagination.limit }).map((_, i) => (
                  <SkeletonRow key={i} cols={colCount} />
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Inbox className="h-10 w-10 text-muted-foreground/50" />
                      <p className="text-sm font-medium text-muted-foreground">
                        {emptyMessage}
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        {emptyDescription}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((row, rowIdx) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b transition-colors hover:bg-muted/50",
                      selectedIds.has(row.id) && "bg-primary/5"
                    )}
                  >
                    {selectable && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        className={cn("px-4 py-3", col.className)}
                      >
                        {getCellValue(row, col)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="text-sm text-muted-foreground">
          {pagination.total > 0 ? (
            <>
              Mostrando {startRecord}-{endRecord} de {pagination.total} registros
            </>
          ) : (
            "Nenhum registro"
          )}
        </div>
        <div className="flex items-center gap-2">
          {onLimitChange && (
            <Select
              value={String(pagination.limit)}
              onValueChange={(val) => onLimitChange(Number(val))}
            >
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} por página
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center gap-1">
            <Tooltip content="Primeira página">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => onPageChange(1)}
                disabled={pagination.page <= 1 || isLoading}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Página anterior">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Tooltip>
            <span className="px-3 text-sm font-medium">
              {pagination.page} / {totalPages}
            </span>
            <Tooltip content="Próxima página">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page >= totalPages || isLoading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Última página">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => onPageChange(totalPages)}
                disabled={pagination.page >= totalPages || isLoading}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
