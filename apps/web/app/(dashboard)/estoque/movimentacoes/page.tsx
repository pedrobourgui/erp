"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  type ColumnDef,
  type SortState,
} from "@/components/tables/data-table";
import {
  useStockMovements,
  type StockMovement,
  type MovementType,
  type MovementReason,
} from "@/hooks/use-inventory";
import { formatDateTime } from "@/lib/utils";
import { SlidersHorizontal, X, ArrowDownLeft, ArrowUpRight, RefreshCw, Repeat2 } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

// ─── Type config ─────────────────────────────────────────────────────────

const typeConfig: Record<MovementType, { label: string; variant: "success" | "destructive" | "warning" | "secondary"; icon: React.ReactNode }> = {
  ENTRY: { label: "Entrada", variant: "success", icon: <ArrowDownLeft className="mr-1 h-3 w-3" /> },
  EXIT: { label: "Saída", variant: "destructive", icon: <ArrowUpRight className="mr-1 h-3 w-3" /> },
  ADJUSTMENT: { label: "Ajuste", variant: "warning", icon: <RefreshCw className="mr-1 h-3 w-3" /> },
  TRANSFER: { label: "Transferência", variant: "secondary", icon: <Repeat2 className="mr-1 h-3 w-3" /> },
};

const reasonLabels: Record<MovementReason, string> = {
  PURCHASE: "Compra",
  SALE: "Venda",
  RETURN: "Devolução",
  ADJUSTMENT: "Ajuste manual",
  TRANSFER: "Transferência",
  DAMAGE: "Avaria",
  EXPIRED: "Vencido",
};

// ─── Columns ────────────────────────────────────────────────────────────

const columns: ColumnDef<StockMovement>[] = [
  {
    id: "createdAt",
    header: "Data",
    accessor: "createdAt",
    sortable: true,
    cell: (row) => (
      <span className="text-sm text-muted-foreground">{formatDateTime(row.createdAt)}</span>
    ),
  },
  {
    id: "productName",
    header: "Produto",
    accessor: "productName",
    sortable: true,
    cell: (row) => (
      <div>
        <p className="font-medium">{row.productName}</p>
        <p className="text-xs text-muted-foreground font-mono">{row.productSku}</p>
      </div>
    ),
  },
  {
    id: "type",
    header: "Tipo",
    accessor: "type",
    cell: (row) => {
      const config = typeConfig[row.type];
      return (
        <Badge variant={config.variant} className="text-xs">
          {config.icon}
          {config.label}
        </Badge>
      );
    },
  },
  {
    id: "quantity",
    header: "Quantidade",
    accessor: "quantity",
    sortable: true,
    cell: (row) => (
      <span className={row.type === "EXIT" ? "font-medium text-destructive" : "font-medium text-emerald-600"}>
        {row.type === "EXIT" ? "-" : "+"}{row.quantity}
      </span>
    ),
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    id: "reason",
    header: "Motivo",
    accessor: "reason",
    cell: (row) => reasonLabels[row.reason] ?? row.reason,
  },
  {
    id: "userName",
    header: "Usuário",
    accessor: "userName",
  },
  {
    id: "warehouseName",
    header: "Depósito",
    accessor: "warehouseName",
  },
];

// ─── Filter options ──────────────────────────────────────────────────────

const typeOptions: { value: MovementType | ""; label: string }[] = [
  { value: "", label: "Todos os tipos" },
  { value: "ENTRY", label: "Entrada" },
  { value: "EXIT", label: "Saída" },
  { value: "ADJUSTMENT", label: "Ajuste" },
  { value: "TRANSFER", label: "Transferência" },
];

const reasonOptions: { value: MovementReason | ""; label: string }[] = [
  { value: "", label: "Todos os motivos" },
  { value: "PURCHASE", label: "Compra" },
  { value: "SALE", label: "Venda" },
  { value: "RETURN", label: "Devolução" },
  { value: "ADJUSTMENT", label: "Ajuste manual" },
  { value: "TRANSFER", label: "Transferência" },
  { value: "DAMAGE", label: "Avaria" },
  { value: "EXPIRED", label: "Vencido" },
];

// ─── Page ───────────────────────────────────────────────────────────────

export default function StockMovementsPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sort, setSort] = useState<SortState | null>(null);
  const [typeFilter, setTypeFilter] = useState<MovementType | "">("");
  const [reasonFilter, setReasonFilter] = useState<MovementReason | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useStockMovements({
    page,
    limit,
    type: typeFilter || undefined,
    reason: reasonFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortBy: sort?.column,
    sortOrder: sort?.direction,
  });

  const movements = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const hasFilters = typeFilter || reasonFilter || dateFrom || dateTo;

  const clearFilters = () => {
    setTypeFilter("");
    setReasonFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Movimentações</h1>
        <p className="text-muted-foreground">Histórico de movimentações de estoque</p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={showFilters ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Filtros
          {hasFilters && (
            <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {[typeFilter, reasonFilter, dateFrom, dateTo].filter(Boolean).length}
            </span>
          )}
        </Button>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-3 w-3" />
            Limpar filtros
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tipo</label>
            <Select
              value={typeFilter || "__all"}
              onValueChange={(val) => { setTypeFilter(val === "__all" ? "" : val as MovementType); setPage(1); }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((opt) => (
                  <SelectItem key={opt.value || "__all"} value={opt.value || "__all"}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Motivo</label>
            <Select
              value={reasonFilter || "__all"}
              onValueChange={(val) => { setReasonFilter(val === "__all" ? "" : val as MovementReason); setPage(1); }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os motivos" />
              </SelectTrigger>
              <SelectContent>
                {reasonOptions.map((opt) => (
                  <SelectItem key={opt.value || "__all"} value={opt.value || "__all"}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Data Início</label>
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="h-9" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Data Fim</label>
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="h-9" />
          </div>
        </div>
      )}

      <DataTable<StockMovement>
        columns={columns}
        data={movements}
        pagination={{ page, limit, total }}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
        sort={sort}
        onSortChange={setSort}
        exportCsv
        isLoading={isLoading}
        emptyMessage="Nenhuma movimentação encontrada"
        emptyDescription="As movimentações de estoque aparecerão aqui."
      />
    </div>
  );
}
