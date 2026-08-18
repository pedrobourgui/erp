"use client";

import {
  Plus,
  ArrowUpCircle,
  ArrowDownCircle,
  Scale,
  CheckCircle2,
  AlertTriangle,
  Undo2,
  Pencil,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { Can } from "@/components/auth/can";
import { RequirePermission } from "@/components/auth/require-permission";
import {
  DataTable,
  type ColumnDef,
} from "@/components/tables/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { Tooltip } from "@/components/ui/tooltip";
import {
  useFinancialEntries,
  type FinancialEntry,
  type FinancialEntryListParams,
  type FinancialEntryStatus,
  type FinancialEntryType,
} from "@/hooks/use-financial-entries";
import { formatCurrency, formatDate } from "@/lib/utils";

import { DeleteEntryDialog } from "./_components/delete-entry-dialog";
import { EditEntryDialog } from "./_components/edit-entry-dialog";
import { EntriesFilters } from "./_components/entries-filters";
import { EntryFormDialog } from "./_components/entry-form-dialog";
import { ReverseSettlementDialog } from "./_components/reverse-settlement-dialog";
import { SettleEntryDialog } from "./_components/settle-entry-dialog";


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

const TYPE_LABEL: Record<FinancialEntryType, string> = {
  REVENUE: "Receita",
  EXPENSE: "Despesa",
  TRANSFER: "Transferência",
};

const TYPE_VARIANT: Record<
  FinancialEntryType,
  "success" | "destructive" | "secondary"
> = {
  REVENUE: "success",
  EXPENSE: "destructive",
  TRANSFER: "secondary",
};

const TYPE_AMOUNT_CLASS: Record<FinancialEntryType, string> = {
  REVENUE: "text-green-600",
  EXPENSE: "text-red-600",
  TRANSFER: "text-muted-foreground",
};

/**
 * FN-04: quem pode o quê.
 *
 * Um título nascido de pedido pertence ao ciclo do pedido — editá-lo por aqui
 * recria a divergência que o lote 2 gastou seu orçamento removendo. A API
 * recusa de qualquer jeito; a tela não oferece, para o usuário não descobrir
 * pelo erro.
 */
function isReversible(entry: FinancialEntry): boolean {
  return entry.kind !== "TRANSACTION" && entry.status !== "PENDING";
}

function isEditable(entry: FinancialEntry): boolean {
  return entry.kind !== "TRANSACTION" && !entry.fromDocument;
}

function isDeletable(entry: FinancialEntry): boolean {
  return (
    entry.kind !== "TRANSACTION" &&
    !entry.fromDocument &&
    ["PENDING", "OVERDUE"].includes(entry.status)
  );
}

/** A título still owing money can be settled; a transaction is money already moved. */
function isSettleable(entry: FinancialEntry): boolean {
  return (
    entry.kind !== "TRANSACTION" &&
    ["PENDING", "PARTIALLY_PAID", "OVERDUE"].includes(entry.status)
  );
}

function FinancialEntriesPageContent() {
  const [filters, setFilters] = useState<FinancialEntryListParams>({
    page: 1,
    limit: 20,
  });
  const [formOpen, setFormOpen] = useState(false);
  const [settling, setSettling] = useState<FinancialEntry | null>(null);
  const [reversing, setReversing] = useState<FinancialEntry | null>(null);
  const [editing, setEditing] = useState<FinancialEntry | null>(null);
  const [deleting, setDeleting] = useState<FinancialEntry | null>(null);

  const { data, isLoading, error, refetch } = useFinancialEntries(filters);
  const entries = data?.data ?? [];
  const totals = data?.totals;
  const meta = data?.meta;
  const overdueTotal =
    (totals?.overdueRevenue ?? 0) + (totals?.overdueExpense ?? 0);

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
      // FN-12: uma transferência entre contas próprias não é receita nem
      // despesa — cor neutra, para não sugerir movimento de resultado.
      cell: (r) => (
        <Badge variant={TYPE_VARIANT[r.type]}>{TYPE_LABEL[r.type]}</Badge>
      ),
    },
    {
      id: "amount",
      header: "Valor",
      className: "text-right",
      headerClassName: "text-right",
      nowrap: true,
      cell: (r) => (
        <Money value={r.amount} signalNegative={false} className={TYPE_AMOUNT_CLASS[r.type]} />
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
      noTruncate: true,
      header: "",
      className: "text-right",
      nowrap: true,
      // FN-04: até agora a única ação possível era baixar. Uma baixa errada só
      // se corrigia no banco.
      cell: (r) => (
        <div className="flex items-center justify-end gap-1">
          {isSettleable(r) && (
            <Can permission="financial:update">
              <Button size="sm" variant="outline" onClick={() => setSettling(r)}>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                {r.kind === "RECEIVABLE" ? "Receber" : "Pagar"}
              </Button>
            </Can>
          )}
          {isReversible(r) && (
            <Can permission="financial:update">
              <Tooltip content="Estornar baixa">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 md:h-8 md:w-8"
                  onClick={() => setReversing(r)}
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              </Tooltip>
            </Can>
          )}
          {isEditable(r) && (
            <Can permission="financial:update">
              <Tooltip content="Editar">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 md:h-8 md:w-8"
                  onClick={() => setEditing(r)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </Tooltip>
            </Can>
          )}
          {isDeletable(r) && (
            <Can permission="financial:delete">
              <Tooltip content="Excluir">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 text-destructive md:h-8 md:w-8"
                  onClick={() => setDeleting(r)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Tooltip>
            </Can>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        {/* FN-03: "Vencidos" é card próprio — antes um título de março seguia
            somando em "Receitas" como se estivesse em dia. */}
        <TotalCard
          label="Vencidos"
          value={overdueTotal}
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          className={overdueTotal > 0 ? "text-red-600" : "text-muted-foreground"}
        />
      </div>

      <EntriesFilters filters={filters} onChange={patchFilters} />

      <DataTable
        columns={columns}
        data={entries}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        rowClassName={(entry) =>
          entry.status === "OVERDUE"
            ? "bg-red-50/60 dark:bg-red-950/20"
            : undefined
        }
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

      {/* FN-04: correção de baixa, edição e exclusão — antes só existiam no banco */}
      <ReverseSettlementDialog
        entry={reversing}
        open={!!reversing}
        onOpenChange={(open) => !open && setReversing(null)}
      />
      <EditEntryDialog
        entry={editing}
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <DeleteEntryDialog
        entry={deleting}
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
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

// AE-27/FN-09: the menu hides this route, but a URL still reaches it — the
// page guard is the real one.
export default function FinancialEntriesPage() {
  return (
    <RequirePermission permission="financial:read" subject="os lançamentos financeiros">
      <FinancialEntriesPageContent />
    </RequirePermission>
  );
}
