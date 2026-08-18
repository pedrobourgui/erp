"use client";

import React, { useCallback, useMemo, useState } from "react";

import { EntityFilterSelect } from "@/components/forms/entity-filter-select";
import { DataTable, type ColumnDef } from "@/components/tables/data-table";
import { FilterField, FilterPanel } from "@/components/tables/filter-panel";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  useCashRegisterSessions,
  useCashRegisters,
  type CashRegisterSession,
} from "@/hooks/use-cash-registers";
import { useFilters } from "@/hooks/use-filters";
import { toEntityOptions } from "@/lib/category-options";
import {formatDateTime} from "@/lib/utils";

// ─── Columns ──────────────────────────────────────────────────────────

const columns: ColumnDef<CashRegisterSession>[] = [
  {
    id: "cashRegister",
    header: "Caixa",
    cell: (row) => row.cashRegister?.name ?? "—",
  },
  {
    id: "operator",
    header: "Operador",
    cell: (row) => row.operator?.name ?? "—",
  },
  {
    id: "openedAt",
    header: "Aberto em",
    cell: (row) => formatDateTime(row.openedAt),
  },
  {
    id: "closedAt",
    header: "Fechado em",
    cell: (row) => (row.closedAt ? formatDateTime(row.closedAt) : "—"),
  },
  {
    id: "openingBalance",
    header: "Saldo abertura",
    cell: (row) => <Money value={row.openingBalance} />,
  },
  {
    id: "closingBalance",
    header: "Saldo fechamento",
    cell: (row) =>
      row.closingBalance != null ? <Money value={row.closingBalance} /> : "—",
  },
  {
    id: "difference",
    header: "Diferença",
    cell: (row) => {
      if (row.difference == null) {
        return "—";
      }
      const diff = Number(row.difference);
      const className =
        diff < 0 ? "text-red-600" : diff > 0 ? "text-green-600" : "";
      return <Money value={diff} signalNegative={false} className={className} />;
    },
  },
  {
    id: "status",
    header: "Status",
    cell: (row) => (
      <Badge variant={row.status === "OPEN" ? "success" : "secondary"}>
        {row.status === "OPEN" ? "Aberto" : "Fechado"}
      </Badge>
    ),
  },
];

// ─── Component ────────────────────────────────────────────────────────

export function SessionHistory() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const resetPage = useCallback(() => setPage(1), []);
  // FT-06: `SessionQueryDto` aceita `cashRegisterId` e `status` e a tela não
  // oferecia nenhum dos dois — com dois PDVs, o histórico vira uma lista
  // intercalada que não responde "como fechou o caixa da loja?".
  const filters = useFilters({ cashRegisterId: "", status: "" }, resetPage);

  const {
    data: registersResp,
    isLoading: registersLoading,
    error: registersError,
  } = useCashRegisters();
  const registerOptions = useMemo(
    () => toEntityOptions(registersResp?.data),
    [registersResp]
  );

  const { data, isLoading, error } = useCashRegisterSessions({
    page,
    limit,
    cashRegisterId: filters.values.cashRegisterId || undefined,
    status: (filters.values.status || undefined) as "OPEN" | "CLOSED" | undefined,
  });
  const sessions = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">
        Histórico de sessões
      </h2>

      <FilterPanel values={filters.values} onClear={filters.clear}>
        <EntityFilterSelect
          id="filtro-caixa"
          label="Caixa"
          value={filters.values.cashRegisterId}
          onChange={(value) => filters.set("cashRegisterId", value)}
          options={registerOptions}
          isLoading={registersLoading}
          error={registersError}
          allLabel="Todos os caixas"
        />

        <FilterField label="Status">
          <Select
            value={filters.values.status || "__all"}
            onValueChange={(v) => filters.set("status", v === "__all" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os status</SelectItem>
              <SelectItem value="OPEN">Aberto</SelectItem>
              <SelectItem value="CLOSED">Fechado</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterPanel>

      <DataTable
        columns={columns}
        data={sessions}
        pagination={{ page, limit, total }}
        onPageChange={setPage}
        onLimitChange={(newLimit) => {
          setLimit(newLimit);
          setPage(1);
        }}
        isLoading={isLoading}
        error={error}
        emptyMessage="Nenhuma sessão registrada"
        emptyDescription="As sessões de caixa abertas e fechadas aparecerão aqui."
      />
    </div>
  );
}
