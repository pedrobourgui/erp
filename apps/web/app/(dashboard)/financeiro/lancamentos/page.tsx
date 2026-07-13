"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  type ColumnDef,
} from "@/components/tables/data-table";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  useFinancialEntries,
  type FinancialEntry,
  type FinancialEntryListParams,
  type FinancialEntryStatus,
} from "@/hooks/use-financial-entries";
import { EntryFormDialog } from "./_components/entry-form-dialog";
import { EntriesFilters } from "./_components/entries-filters";
import { SettleEntryDialog } from "./_components/settle-entry-dialog";
import { Plus, ArrowUpCircle, ArrowDownCircle, Scale, CheckCircle2 } from "lucide-react";

const STATUS_LABEL: Record<FinancialEntryStatus, string> = {
  PAID: "Pago",
  PENDING: "Em aberto",
  PARTIALLY_PAID: "Parcial",
  OVERDUE: "Vencido",
  CANCELLED: "Cancelado",
  REFUNDED: "Estornado",
};

const STATUS_VARIANT: Record<
  FinancialEntryStatus,
  "success" | "warning" | "destructive" | "secondary"
> = {
  PAID: "success",
  PENDING: "warning",
  PARTIALLY_PAID: "warning",
  OVERDUE: "destructive",
  CANCELLED: "secondary",
  REFUNDED: "secondary",
};

/** A título still owing money can be settled; a transaction is money already moved. */
function isSettleable(entry: FinancialEntry): boolean {
  return (
    entry.kind !== "TRANSACTION" &&
    ["PENDING", "PARTIALLY_PAID", "OVERDUE"].includes(entry.status)
  );
}

export default function FinancialEntriesPage() {
  const [filters, setFilters] = useState<FinancialEntryListParams>({
    page: 1,
    limit: 20,
  });
  const [formOpen, setFormOpen] = useState(false);
  const [settling, setSettling] = useState<FinancialEntry | null>(null);

  const { data, isLoading } = useFinancialEntries(filters);
  const entries = data?.data ?? [];
  const totals = data?.totals;
  const meta = data?.meta;

  const patchFilters = (patch: Partial<FinancialEntryListParams>) =>
    setFilters((prev) => ({ ...prev, ...patch, page: 1 }));

  const columns: ColumnDef<FinancialEntry>[] = [
    { id: "date", header: "Data", cell: (r) => formatDate(r.date) },
    { id: "description", header: "Descrição", accessor: "description" },
    { id: "category", header: "Categoria", cell: (r) => r.categoryName ?? "-" },
    { id: "account", header: "Conta", cell: (r) => r.accountName ?? "-" },
    {
      id: "type",
      header: "Tipo",
      cell: (r) => (
        <Badge variant={r.type === "REVENUE" ? "success" : "destructive"}>
          {r.type === "REVENUE" ? "Receita" : "Despesa"}
        </Badge>
      ),
    },
    {
      id: "amount",
      header: "Valor",
      className: "text-right font-mono",
      headerClassName: "text-right",
      cell: (r) => (
        <span className={r.type === "REVENUE" ? "text-green-600" : "text-red-600"}>
          {formatCurrency(r.amount)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (r) => (
        <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (r) =>
        isSettleable(r) ? (
          <Button size="sm" variant="outline" onClick={() => setSettling(r)}>
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            {r.kind === "RECEIVABLE" ? "Receber" : "Pagar"}
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Despesas e Receitas
          </h1>
          <p className="text-muted-foreground">
            Vendas, lançamentos manuais e títulos em aberto
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Lançamento
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <TotalCard
          label="Receitas"
          value={totals?.revenue ?? 0}
          icon={<ArrowUpCircle className="h-5 w-5 text-green-600" />}
          className="text-green-600"
        />
        <TotalCard
          label="Despesas"
          value={totals?.expense ?? 0}
          icon={<ArrowDownCircle className="h-5 w-5 text-red-600" />}
          className="text-red-600"
        />
        <TotalCard
          label="Saldo do período"
          value={totals?.balance ?? 0}
          icon={<Scale className="h-5 w-5 text-muted-foreground" />}
          className={
            (totals?.balance ?? 0) >= 0 ? "text-green-600" : "text-red-600"
          }
        />
      </div>

      <EntriesFilters filters={filters} onChange={patchFilters} />

      <DataTable
        columns={columns}
        data={entries}
        isLoading={isLoading}
        pagination={{
          page: meta?.page ?? 1,
          limit: meta?.limit ?? 20,
          total: meta?.total ?? 0,
        }}
        onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
        emptyMessage="Nenhum lançamento encontrado"
        emptyDescription="Ajuste os filtros ou registre um novo lançamento."
      />

      <EntryFormDialog open={formOpen} onOpenChange={setFormOpen} />
      <SettleEntryDialog
        entry={settling}
        onOpenChange={(open) => !open && setSettling(null)}
      />
    </div>
  );
}

function TotalCard({
  label,
  value,
  icon,
  className,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold ${className ?? ""}`}>
            {formatCurrency(value)}
          </p>
        </div>
        {icon}
      </CardContent>
    </Card>
  );
}
