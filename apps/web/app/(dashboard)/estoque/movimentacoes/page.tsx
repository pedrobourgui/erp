"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Repeat2,
  Plus,
  Undo2,
  Factory,
} from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";

import { RequirePermission } from "@/components/auth/require-permission";
import { EntityFilterSelect } from "@/components/forms/entity-filter-select";
import { SearchableSelectBase } from "@/components/forms/searchable-select";
import { ListPageHeader } from "@/components/layouts/list-page-header";
import {
  DataTable,
  type ColumnDef,
  type SortState,
} from "@/components/tables/data-table";
import { DateRangeFilter } from "@/components/tables/date-range-filter";
import { FilterField, FilterPanel } from "@/components/tables/filter-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useFilters } from "@/hooks/use-filters";
import {
  useStockMovements,
  useWarehouses,
  type StockMovement,
  type MovementType,
  type MovementReason,
} from "@/hooks/use-inventory";
import { toEntityOptions } from "@/lib/category-options";
import { searchProducts } from "@/lib/entity-search";
import { movementDirection } from "@/lib/movement-direction";
import { cn, formatDateTime, isInvertedRange } from "@/lib/utils";

import { MovementFormDialog } from "./_components/movement-form-dialog";


// ─── Type config ─────────────────────────────────────────────────────────

type TypeConfig = {
  label: string;
  variant: "success" | "destructive" | "warning" | "secondary";
  icon: React.ReactNode;
};

const typeConfig: Record<MovementType, TypeConfig> = {
  ENTRY: { label: "Entrada", variant: "success", icon: <ArrowDownLeft className="mr-1 h-3 w-3" /> },
  EXIT: { label: "Saída", variant: "destructive", icon: <ArrowUpRight className="mr-1 h-3 w-3" /> },
  ADJUSTMENT: { label: "Ajuste", variant: "warning", icon: <RefreshCw className="mr-1 h-3 w-3" /> },
  TRANSFER: { label: "Transferência", variant: "secondary", icon: <Repeat2 className="mr-1 h-3 w-3" /> },
  RETURN: { label: "Devolução", variant: "warning", icon: <Undo2 className="mr-1 h-3 w-3" /> },
  PRODUCTION: { label: "Produção", variant: "secondary", icon: <Factory className="mr-1 h-3 w-3" /> },
};

// A movement type added to the database enum must never break the whole page.
const fallbackTypeConfig: TypeConfig = {
  label: "Outro",
  variant: "secondary",
  icon: null,
};

const reasonLabels: Record<MovementReason, string> = {
  PURCHASE: "Compra",
  SALE: "Venda",
  TRANSFER: "Transferência",
  ADJUSTMENT: "Ajuste manual",
  RETURN_CUSTOMER: "Devolução de cliente",
  RETURN_SUPPLIER: "Devolução a fornecedor",
  DAMAGE: "Avaria",
  THEFT: "Furto/Perda",
  PRODUCTION: "Produção",
  INITIAL: "Saldo inicial",
  COUNT: "Inventário/Contagem",
};

/** Sign shown before the quantity, by the direction the stock actually moved. */
const DIRECTION_PREFIX: Record<"in" | "out" | "neutral", string> = {
  in: "+",
  out: "−",
  neutral: "↔ ",
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
      // O `truncate` da DataTable fica no wrapper e não alcança um <p> aninhado:
      // um nome sem espaços é pintado por cima da coluna seguinte.
      <div className="min-w-0">
        <p className="truncate font-medium">{row.productName}</p>
        <p className="truncate text-xs font-mono text-muted-foreground">{row.productSku}</p>
      </div>
    ),
  },
  {
    id: "type",
    header: "Tipo",
    accessor: "type",
    cell: (row) => {
      const config = typeConfig[row.type] ?? fallbackTypeConfig;
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
    cell: (row) => {
      const direction = movementDirection(row);
      return (
        <span
          className={cn(
            "font-medium",
            direction === "out" && "text-destructive",
            direction === "in" && "text-emerald-600",
            direction === "neutral" && "text-muted-foreground"
          )}
        >
          {DIRECTION_PREFIX[direction]}
          {row.quantity}
        </span>
      );
    },
    className: "text-right",
    nowrap: true,
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

// AE-25: derived from the badge maps above instead of retyped. The hand-written
// list held 4 of the 6 types — Devolução and Produção rendered as badges in the
// table but could never be filtered, which reads as "there are none".
const typeOptions: { value: MovementType | ""; label: string }[] = [
  { value: "", label: "Todos os tipos" },
  ...(Object.entries(typeConfig) as [MovementType, TypeConfig][]).map(
    ([value, config]) => ({ value, label: config.label })
  ),
];

const reasonOptions: { value: MovementReason | ""; label: string }[] = [
  { value: "", label: "Todos os motivos" },
  ...(Object.entries(reasonLabels) as [MovementReason, string][]).map(
    ([value, label]) => ({ value, label })
  ),
];

// ─── Page ───────────────────────────────────────────────────────────────

function StockMovementsPageContent() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sort, setSort] = useState<SortState | null>(null);
  const [movementFormOpen, setMovementFormOpen] = useState(false);

  const resetPage = useCallback(() => setPage(1), []);
  const filters = useFilters(
    { type: "", reason: "", warehouseId: "", productId: "", dateFrom: "", dateTo: "" },
    resetPage
  );
  const { dateFrom, dateTo } = filters.values;
  const invertedRange = isInvertedRange(dateFrom, dateTo);

  // FT-03: `MovementQueryDto` aceita `productId` e `warehouseId` desde sempre —
  // "o que entrou e saiu do Depósito Central esta semana?" é a pergunta desta
  // tela e exigia rolar a listagem inteira.
  const {
    data: warehousesResp,
    isLoading: warehousesLoading,
    error: warehousesError,
  } = useWarehouses();
  const warehouseOptions = useMemo(
    () => toEntityOptions(warehousesResp?.data),
    [warehousesResp]
  );

  const { data, isLoading, error, refetch } = useStockMovements({
    page,
    limit,
    type: (filters.values.type || undefined) as MovementType | undefined,
    reason: (filters.values.reason || undefined) as MovementReason | undefined,
    warehouseId: filters.values.warehouseId || undefined,
    productId: filters.values.productId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortBy: sort?.column,
    sortOrder: sort?.direction,
  });

  const movements = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  return (
    <div className="space-y-4">
      <ListPageHeader
        title="Movimentações"
        description="Histórico de movimentações de estoque"
        actions={
          <Button onClick={() => setMovementFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova movimentação
          </Button>
        }
      />


      <DataTable<StockMovement>
        filters={
          <FilterPanel values={filters.values} onClear={filters.clear}>
            {/*
              O campo largo vem primeiro para o grid fechar as linhas.
              No fim da lista ele não cabia no que sobrava da primeira linha e
              descia inteiro, deixando um buraco no meio do painel. À frente,
              ele e dois estreitos fecham a linha exata — e Produto é o filtro
              mais usado desta tela de qualquer forma.
            */}
            <FilterField label="Produto" span={2}>
              {/* Milhares de produtos não cabem num dropdown: busca no servidor,
                  o mesmo componente do modal de movimentação. */}
              <SearchableSelectBase
                value={filters.values.productId}
                onChange={(value) => filters.set("productId", value)}
                loadOptions={searchProducts}
                placeholder="Todos os produtos"
              />
            </FilterField>

            <FilterField label="Tipo">
              <Select
                value={filters.values.type || "__all"}
                onValueChange={(v) => filters.set("type", v === "__all" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((opt) => (
                    <SelectItem key={opt.value || "__all"} value={opt.value || "__all"}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Motivo">
              <Select
                value={filters.values.reason || "__all"}
                onValueChange={(v) => filters.set("reason", v === "__all" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os motivos" />
                </SelectTrigger>
                <SelectContent>
                  {reasonOptions.map((opt) => (
                    <SelectItem key={opt.value || "__all"} value={opt.value || "__all"}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <EntityFilterSelect
              id="filtro-deposito"
              label="Depósito"
              value={filters.values.warehouseId}
              onChange={(value) => filters.set("warehouseId", value)}
              options={warehouseOptions}
              isLoading={warehousesLoading}
              error={warehousesError}
              allLabel="Todos os depósitos"
            />

            <DateRangeFilter
              from={dateFrom}
              to={dateTo}
              onFromChange={(value) => filters.set("dateFrom", value)}
              onToChange={(value) => filters.set("dateTo", value)}
              inverted={invertedRange}
            />
          </FilterPanel>
        }
        columns={columns}
        data={movements}
        pagination={{ page, limit, total }}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
        sort={sort}
        onSortChange={setSort}
        exportCsv
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        emptyMessage="Nenhuma movimentação encontrada"
        emptyDescription="As movimentações de estoque aparecerão aqui."
      />

      <MovementFormDialog open={movementFormOpen} onOpenChange={setMovementFormOpen} />
    </div>
  );
}

// AE-27/FN-09: the menu hides this route, but a URL still reaches it — the
// page guard is the real one.
export default function StockMovementsPage() {
  return (
    <RequirePermission permission="inventory:read" subject="as movimentações de estoque">
      <StockMovementsPageContent />
    </RequirePermission>
  );
}
