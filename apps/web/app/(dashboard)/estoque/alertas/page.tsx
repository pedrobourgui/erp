"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  type ColumnDef,
} from "@/components/tables/data-table";
import {
  useStockAlerts,
  type StockAlert,
  type AlertStatus,
} from "@/hooks/use-inventory";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

// ─── Columns ────────────────────────────────────────────────────────────

const columns: ColumnDef<StockAlert>[] = [
  {
    id: "productName",
    header: "Produto",
    accessor: "productName",
    cell: (row) => (
      <div>
        <Link
          href={`/estoque/produtos/${row.productId}`}
          className="font-medium text-primary hover:underline"
        >
          {row.productName}
        </Link>
        <p className="text-xs text-muted-foreground font-mono">{row.productSku}</p>
      </div>
    ),
  },
  {
    id: "currentStock",
    header: "Estoque Atual",
    accessor: "currentStock",
    cell: (row) => (
      <span className={row.currentStock === 0 ? "font-semibold text-destructive" : "font-semibold text-yellow-600"}>
        {row.currentStock}
      </span>
    ),
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    id: "minStock",
    header: "Estoque Mínimo",
    accessor: "minStock",
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    id: "warehouseName",
    header: "Depósito",
    accessor: "warehouseName",
  },
  {
    id: "status",
    header: "Status",
    accessor: "status",
    cell: (row) => {
      if (row.status === "ACTIVE") {
        return (
          <Badge variant="warning" className="text-xs">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Ativo
          </Badge>
        );
      }
      return (
        <Badge variant="success" className="text-xs">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Resolvido
        </Badge>
      );
    },
  },
];

// ─── Filter options ──────────────────────────────────────────────────────

const statusOptions: { value: AlertStatus | ""; label: string }[] = [
  { value: "", label: "Todos os status" },
  { value: "ACTIVE", label: "Ativo" },
  { value: "RESOLVED", label: "Resolvido" },
];

// ─── Page ───────────────────────────────────────────────────────────────

export default function StockAlertsPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [statusFilter, setStatusFilter] = useState<AlertStatus | "">("");

  const { data, isLoading } = useStockAlerts({
    page,
    limit,
    status: statusFilter || undefined,
  });

  const alerts = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Alertas de Estoque</h1>
        <p className="text-muted-foreground">Produtos com estoque abaixo do mínimo</p>
      </div>

      <div className="flex items-center gap-3">
        <Select
          value={statusFilter || "__all"}
          onValueChange={(val) => { setStatusFilter(val === "__all" ? "" : val as AlertStatus); setPage(1); }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((opt) => (
              <SelectItem key={opt.value || "__all"} value={opt.value || "__all"}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {statusFilter && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter(""); setPage(1); }}>
            Limpar filtro
          </Button>
        )}
      </div>

      <DataTable<StockAlert>
        columns={columns}
        data={alerts}
        pagination={{ page, limit, total }}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
        isLoading={isLoading}
        emptyMessage="Nenhum alerta de estoque"
        emptyDescription="Todos os produtos estão com estoque acima do mínimo."
      />
    </div>
  );
}
