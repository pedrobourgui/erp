"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { DataTable, type ColumnDef } from "@/components/tables/data-table";
import {
  useCashRegisterSessions,
  type CashRegisterSession,
} from "@/hooks/use-cash-registers";
import { formatCurrency, formatDateTime } from "@/lib/utils";

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
    cell: (row) => formatCurrency(row.openingBalance),
  },
  {
    id: "closingBalance",
    header: "Saldo fechamento",
    cell: (row) =>
      row.closingBalance != null ? formatCurrency(row.closingBalance) : "—",
  },
  {
    id: "difference",
    header: "Diferença",
    cell: (row) => {
      if (row.difference == null) return "—";
      const diff = Number(row.difference);
      const className =
        diff < 0 ? "text-red-600" : diff > 0 ? "text-green-600" : "";
      return <span className={className}>{formatCurrency(diff)}</span>;
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

  const { data, isLoading } = useCashRegisterSessions({ page, limit });
  const sessions = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">
        Histórico de sessões
      </h2>
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
        emptyMessage="Nenhuma sessão registrada"
        emptyDescription="As sessões de caixa abertas e fechadas aparecerão aqui."
      />
    </div>
  );
}
