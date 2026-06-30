"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DataTable,
  type ColumnDef,
  type SortState,
} from "@/components/tables/data-table";
import {
  useOrders,
  useUpdateOrderStatus,
  type OrderListItem,
} from "@/hooks/use-orders";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import {
  Eye,
  CheckCircle2,
  Truck,
  XCircle,
  SlidersHorizontal,
  X,
  Store,
  Globe,
  ShoppingBag,
  Smartphone,
  Plus,
} from "lucide-react";
import type { OrderStatus, OrderOrigin } from "@erp/shared-types";
import { Tooltip } from "@/components/ui/tooltip";

// ─── Origin icons ───────────────────────────────────────────────────────

const originIcons: Record<string, React.ReactNode> = {
  MANUAL: <Store className="h-4 w-4 text-slate-500" />,
  BALCAO: <Store className="h-4 w-4 text-emerald-500" />,
  SHOPIFY: <Globe className="h-4 w-4 text-blue-500" />,
  NUVEMSHOP: <Globe className="h-4 w-4 text-blue-500" />,
  WOOCOMMERCE: <Globe className="h-4 w-4 text-blue-500" />,
  MERCADO_LIVRE: <ShoppingBag className="h-4 w-4 text-orange-500" />,
  SHOPEE: <ShoppingBag className="h-4 w-4 text-orange-500" />,
  AMAZON: <ShoppingBag className="h-4 w-4 text-orange-500" />,
  MAGALU: <ShoppingBag className="h-4 w-4 text-orange-500" />,
  API: <Smartphone className="h-4 w-4 text-purple-500" />,
};

const originLabels: Record<string, string> = {
  MANUAL: "Manual",
  BALCAO: "Balcão",
  SHOPIFY: "Shopify",
  NUVEMSHOP: "Nuvemshop",
  WOOCOMMERCE: "WooCommerce",
  MERCADO_LIVRE: "Mercado Livre",
  SHOPEE: "Shopee",
  AMAZON: "Amazon",
  MAGALU: "Magalu",
  API: "API",
};

// ─── Columns ────────────────────────────────────────────────────────────

const columns: ColumnDef<OrderListItem>[] = [
  {
    id: "orderNumber",
    header: "Pedido",
    accessor: "orderNumber",
    sortable: true,
    cell: (row) => (
      <Link
        href={`/vendas/pedidos/${row.id}`}
        className="font-medium text-primary hover:underline"
      >
        #{row.orderNumber}
      </Link>
    ),
  },
  {
    id: "customerName",
    header: "Cliente",
    accessor: "customerName",
    sortable: true,
    cell: (row) => (
      <span>{row.customerName ?? (row as any).customer?.name ?? "-"}</span>
    ),
  },
  {
    id: "createdAt",
    header: "Data",
    accessor: "createdAt",
    sortable: true,
    cell: (row) => (
      <span className="text-sm text-muted-foreground">
        {formatDateTime(row.createdAt)}
      </span>
    ),
  },
  {
    id: "origin",
    header: "Origem",
    accessor: "origin",
    cell: (row) => (
      <div className="flex items-center gap-2">
        {originIcons[row.origin] ?? null}
        <span className="text-sm">{originLabels[row.origin] ?? row.origin}</span>
        {row.marketplace && (
          <span className="text-xs text-muted-foreground">
            ({row.marketplace})
          </span>
        )}
      </div>
    ),
  },
  {
    id: "status",
    header: "Status",
    accessor: "status",
    cell: (row) => <StatusBadge status={row.status} />,
  },
  {
    id: "totalAmount",
    header: "Total",
    accessor: "totalAmount",
    sortable: true,
    cell: (row) => (
      <span className="font-medium">{formatCurrency(row.totalAmount)}</span>
    ),
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    id: "actions",
    header: "Ações",
    cell: (row) => <QuickActions order={row} />,
    className: "text-right",
    headerClassName: "text-right",
  },
];

// ─── Quick actions per row ──────────────────────────────────────────────

function QuickActions({ order }: { order: OrderListItem }) {
  const router = useRouter();
  const updateStatus = useUpdateOrderStatus();
  const { addToast } = useToast();
  const [confirmAction, setConfirmAction] = useState<{
    open: boolean;
    status: OrderStatus;
    title: string;
    message: string;
    destructive: boolean;
  } | null>(null);

  const actions: {
    status: OrderStatus;
    label: string;
    icon: React.ReactNode;
    show: boolean;
    destructive?: boolean;
  }[] = [
    {
      status: "CONFIRMED",
      label: "Confirmar",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      show: order.status === "PENDING",
    },
    {
      status: "SHIPPED",
      label: "Enviar",
      icon: <Truck className="h-3.5 w-3.5" />,
      show: ["CONFIRMED", "PICKING"].includes(order.status),
    },
    {
      status: "CANCELLED",
      label: "Cancelar",
      icon: <XCircle className="h-3.5 w-3.5" />,
      show: ["PENDING", "CONFIRMED"].includes(order.status),
      destructive: true,
    },
  ];

  const visibleActions = actions.filter((a) => a.show);

  return (
    <div className="flex items-center justify-end gap-1">
      <Tooltip content="Ver detalhes">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => router.push(`/vendas/pedidos/${order.id}`)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      </Tooltip>
      {visibleActions.map((action) => (
        <Tooltip key={action.status} content={action.label}>
          <Button
            variant="ghost"
            action={action.destructive ? "delete" : "success"}
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              setConfirmAction({
                open: true,
                status: action.status,
                title: action.label + " Pedido",
                message: `Deseja ${action.label.toLowerCase()} o pedido #${order.orderNumber}?`,
                destructive: action.destructive ?? false,
              })
            }
          >
            {action.icon}
          </Button>
        </Tooltip>
      ))}

      {confirmAction && (
        <ConfirmDialog
          open={confirmAction.open}
          onOpenChange={(open) =>
            setConfirmAction(open ? confirmAction : null)
          }
          title={confirmAction.title}
          message={confirmAction.message}
          destructive={confirmAction.destructive}
          loading={updateStatus.isPending}
          onConfirm={async () => {
            try {
              await updateStatus.mutateAsync({
                id: order.id,
                status: confirmAction.status,
              });
              addToast(`Pedido #${order.orderNumber} atualizado com sucesso!`, "success");
              setConfirmAction(null);
            } catch {
              addToast("Erro ao atualizar pedido. Tente novamente.", "error");
              setConfirmAction(null);
            }
          }}
        />
      )}
    </div>
  );
}

// ─── Filter options ─────────────────────────────────────────────────────

const statusOptions: { value: OrderStatus | ""; label: string }[] = [
  { value: "", label: "Todos os status" },
  { value: "PENDING", label: "Pendente" },
  { value: "CONFIRMED", label: "Confirmado" },
  { value: "PICKING", label: "Separando" },
  { value: "PACKED", label: "Embalado" },
  { value: "SHIPPED", label: "Enviado" },
  { value: "DELIVERED", label: "Entregue" },
  { value: "CANCELLED", label: "Cancelado" },
  { value: "RETURNED", label: "Devolvido" },
];

const originOptions: { value: OrderOrigin | ""; label: string }[] = [
  { value: "", label: "Todas as origens" },
  { value: "MANUAL", label: "Manual" },
  { value: "BALCAO", label: "Balcão" },
  { value: "MERCADO_LIVRE", label: "Mercado Livre" },
  { value: "SHOPEE", label: "Shopee" },
  { value: "AMAZON", label: "Amazon" },
  { value: "MAGALU", label: "Magalu" },
  { value: "SHOPIFY", label: "Shopify" },
  { value: "NUVEMSHOP", label: "Nuvemshop" },
  { value: "WOOCOMMERCE", label: "WooCommerce" },
  { value: "API", label: "API" },
];

// ─── Page ───────────────────────────────────────────────────────────────

export default function OrdersListPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [originFilter, setOriginFilter] = useState<OrderOrigin | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useOrders({
    page,
    limit,
    search: search || undefined,
    sortBy: sort?.column,
    sortOrder: sort?.direction,
    status: statusFilter || undefined,
    origin: originFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const orders = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  const hasFilters = statusFilter || originFilter || dateFrom || dateTo;

  const clearFilters = () => {
    setStatusFilter("");
    setOriginFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-muted-foreground">
            Gerencie todos os pedidos de venda
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/vendas/balcao">
            <Button variant="outline">
              <Store className="mr-2 h-4 w-4" />
              Venda Balcão
            </Button>
          </Link>
          <Link href="/vendas/pedidos/novo">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Venda
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters toggle */}
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
              {[statusFilter, originFilter, dateFrom, dateTo].filter(Boolean).length}
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

      {/* Filters panel */}
      {showFilters && (
        <div className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as OrderStatus | "");
                setPage(1);
              }}
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Origem
            </label>
            <select
              value={originFilter}
              onChange={(e) => {
                setOriginFilter(e.target.value as OrderOrigin | "");
                setPage(1);
              }}
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              {originOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Data Início
            </label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Data Fim
            </label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="h-9"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <DataTable<OrderListItem>
        columns={columns}
        data={orders}
        pagination={{ page, limit, total }}
        onPageChange={setPage}
        onLimitChange={(l) => {
          setLimit(l);
          setPage(1);
        }}
        sort={sort}
        onSortChange={setSort}
        searchValue={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder="Buscar por número ou cliente..."
        exportCsv
        isLoading={isLoading}
      />
    </div>
  );
}
