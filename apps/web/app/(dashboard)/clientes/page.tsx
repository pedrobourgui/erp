"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import {
  DataTable,
  type ColumnDef,
  type SortState,
} from "@/components/tables/data-table";
import {
  useCustomers,
  useDeleteCustomer,
  type CustomerListItem,
  type CustomerSegment,
} from "@/hooks/use-customers";
import { formatCurrency } from "@/lib/utils";
import { maskDocument, maskPhone } from "@/lib/masks";
import { Plus, SlidersHorizontal, X, Eye, Trash2 } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

// ─── Config ─────────────────────────────────────────────────────────────

const segmentLabels: Record<CustomerSegment, string> = {
  regular: "Regular",
  vip: "VIP",
  wholesale: "Atacado",
  inactive: "Inativo",
};

const segmentVariants: Record<CustomerSegment, "default" | "success" | "warning" | "secondary"> = {
  regular: "secondary",
  vip: "success",
  wholesale: "default",
  inactive: "warning",
};

// ─── Actions cell ───────────────────────────────────────────────────────

function CustomerActions({ customer }: { customer: CustomerListItem }) {
  const router = useRouter();
  const deleteCustomer = useDeleteCustomer();
  const { addToast } = useToast();
  const [showDelete, setShowDelete] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteCustomer.mutateAsync(customer.id);
      addToast("Cliente excluído com sucesso!", "success");
    } catch {
      addToast("Erro ao excluir cliente.", "error");
    }
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Tooltip content="Ver detalhes">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push(`/clientes/${customer.id}`)}>
          <Eye className="h-4 w-4" />
        </Button>
      </Tooltip>
      <Tooltip content="Excluir">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setShowDelete(true)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </Tooltip>
      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Excluir Cliente"
        message={`Deseja excluir "${customer.name}"? Esta ação não pode ser desfeita.`}
        destructive
        confirmLabel="Excluir"
        loading={deleteCustomer.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ─── Columns ────────────────────────────────────────────────────────────

const columns: ColumnDef<CustomerListItem>[] = [
  {
    id: "name",
    header: "Nome",
    accessor: "name",
    sortable: true,
    cell: (row) => (
      <Link href={`/clientes/${row.id}`} className="font-medium text-primary hover:underline">
        {row.name}
      </Link>
    ),
  },
  {
    id: "type",
    header: "Tipo",
    accessor: "documentType",
    cell: (row) => (
      <Badge variant="outline" className="text-xs">
        {row.documentType === "CPF" ? "Pessoa Física" : "Pessoa Jurídica"}
      </Badge>
    ),
  },
  {
    id: "document",
    header: "Documento",
    accessor: "document",
    cell: (row) => (
      <span className="font-mono text-xs">
        {row.documentType ? maskDocument(row.document, row.documentType) : row.document}
      </span>
    ),
  },
  {
    id: "email",
    header: "E-mail",
    accessor: "email",
    cell: (row) => (
      <span className="text-sm text-muted-foreground">{row.email}</span>
    ),
  },
  {
    id: "phone",
    header: "Telefone",
    accessor: "phone",
    cell: (row) => (
      <span className="text-sm">{maskPhone(row.phone)}</span>
    ),
  },
  {
    id: "totalOrders",
    header: "Pedidos",
    accessor: "totalOrders",
    sortable: true,
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    id: "totalSpent",
    header: "Total Gasto",
    accessor: "totalSpent",
    sortable: true,
    cell: (row) => <span className="font-medium">{formatCurrency(row.totalSpent)}</span>,
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    id: "actions",
    header: "Ações",
    cell: (row) => <CustomerActions customer={row} />,
    className: "text-right w-[100px]",
    headerClassName: "text-right",
  },
];

// ─── Filter options ──────────────────────────────────────────────────────

const segmentOptions: { value: CustomerSegment | ""; label: string }[] = [
  { value: "", label: "Todos os segmentos" },
  { value: "regular", label: "Regular" },
  { value: "vip", label: "VIP" },
  { value: "wholesale", label: "Atacado" },
  { value: "inactive", label: "Inativo" },
];

// ─── Page ───────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState | null>(null);
  const [segmentFilter, setSegmentFilter] = useState<CustomerSegment | "">("");
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useCustomers({
    page,
    limit,
    search: search || undefined,
    segment: segmentFilter || undefined,
    sortBy: sort?.column,
    sortOrder: sort?.direction,
  });

  const customers = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const hasFilters = !!segmentFilter;

  const clearFilters = () => {
    setSegmentFilter("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">Gerencie sua base de clientes</p>
        </div>
        <Button onClick={() => router.push("/clientes/novo")}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Cliente
        </Button>
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
              {[segmentFilter].filter(Boolean).length}
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
        <div className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-1">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Segmento</label>
            <select
              value={segmentFilter}
              onChange={(e) => { setSegmentFilter(e.target.value as CustomerSegment | ""); setPage(1); }}
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              {segmentOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <DataTable<CustomerListItem>
        columns={columns}
        data={customers}
        pagination={{ page, limit, total }}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
        sort={sort}
        onSortChange={setSort}
        searchValue={search}
        onSearchChange={(val) => { setSearch(val); setPage(1); }}
        searchPlaceholder="Buscar por nome, e-mail ou documento..."
        exportCsv
        isLoading={isLoading}
      />
    </div>
  );
}
