"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import {
  DataTable,
  type ColumnDef,
  type SortState,
} from "@/components/tables/data-table";
import { useProducts, useDeleteProduct } from "@/hooks/use-products";
import { formatCurrency } from "@/lib/utils";
import {
  Plus,
  SlidersHorizontal,
  X,
  Eye,
  Edit,
  Trash2,
} from "lucide-react";
import type { Product, ProductStatus } from "@erp/shared-types";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

// ─── Product row from API ────────────────────────────────────────────────

interface ProductRow {
  id: string;
  sku: string;
  name: string;
  status: string;
  salePrice: number;
  costPrice: number;
  category?: { id: string; name: string } | null;
  brand?: { id: string; name: string } | null;
  inventory?: { totalQuantity: number; totalReserved: number; totalAvailable: number };
}

// ─── Actions cell ───────────────────────────────────────────────────────

function ProductActions({ product }: { product: ProductRow }) {
  const router = useRouter();
  const deleteProduct = useDeleteProduct();
  const { addToast } = useToast();
  const [showDelete, setShowDelete] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteProduct.mutateAsync(product.id);
      addToast("Produto excluído com sucesso!", "success");
    } catch {
      addToast("Erro ao excluir produto.", "error");
    }
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Tooltip content="Ver detalhes">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push(`/estoque/produtos/${product.id}`)}>
          <Eye className="h-4 w-4" />
        </Button>
      </Tooltip>
      <Tooltip content="Editar">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push(`/estoque/produtos/${product.id}/edit`)}>
          <Edit className="h-4 w-4" />
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
        title="Excluir Produto"
        message={`Deseja excluir "${product.name}"? Esta ação não pode ser desfeita.`}
        destructive
        confirmLabel="Excluir"
        loading={deleteProduct.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ─── Columns ────────────────────────────────────────────────────────────

const columns: ColumnDef<ProductRow>[] = [
  {
    id: "sku",
    header: "SKU",
    accessor: "sku",
    sortable: true,
    className: "font-mono text-xs",
  },
  {
    id: "name",
    header: "Produto",
    accessor: "name",
    sortable: true,
    cell: (row) => (
      <Link
        href={`/estoque/produtos/${row.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.name}
      </Link>
    ),
  },
  {
    id: "category",
    header: "Categoria",
    accessor: (row) => row.category?.name ?? "-",
  },
  {
    id: "salePrice",
    header: "Preço",
    accessor: "salePrice",
    sortable: true,
    cell: (row) => formatCurrency(row.salePrice),
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    id: "stock",
    header: "Estoque",
    accessor: (row) => row.inventory?.totalAvailable ?? 0,
    sortable: true,
    cell: (row) => {
      const qty = row.inventory?.totalAvailable ?? 0;
      return (
        <span
          className={
            qty <= 0
              ? "font-medium text-destructive"
              : qty <= 10
                ? "font-medium text-yellow-600"
                : ""
          }
        >
          {qty}
        </span>
      );
    },
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    id: "status",
    header: "Status",
    accessor: "status",
    cell: (row) => <StatusBadge status={row.status} />,
  },
  {
    id: "actions",
    header: "Ações",
    cell: (row) => <ProductActions product={row} />,
    className: "text-right w-[120px]",
    headerClassName: "text-right",
  },
];

// ─── Filters ────────────────────────────────────────────────────────────

const statusOptions: { value: ProductStatus | ""; label: string }[] = [
  { value: "", label: "Todos os status" },
  { value: "ACTIVE", label: "Ativo" },
  { value: "INACTIVE", label: "Inativo" },
  { value: "DRAFT", label: "Rascunho" },
];

// ─── Page ───────────────────────────────────────────────────────────────

export default function ProductsListPage() {
  const router = useRouter();

  // State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  // Data
  const { data, isLoading } = useProducts({
    page,
    limit,
    search: search || undefined,
    sortBy: sort?.column,
    sortOrder: sort?.direction,
    status: statusFilter || undefined,
    categoryId: categoryFilter || undefined,
    brandId: brandFilter || undefined,
  });

  const products = (data?.data ?? []) as ProductRow[];
  const total = data?.meta?.total ?? 0;

  const hasFilters = statusFilter || categoryFilter || brandFilter;

  const clearFilters = () => {
    setStatusFilter("");
    setCategoryFilter("");
    setBrandFilter("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">
            Gerencie seu catálogo de produtos
          </p>
        </div>
        <Button onClick={() => router.push("/estoque/produtos/novo")}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Produto
        </Button>
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
              {[statusFilter, categoryFilter, brandFilter].filter(Boolean).length}
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

      {/* Filter panel */}
      {showFilters && (
        <div className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Status
            </label>
            <Select
              value={statusFilter || "__all"}
              onValueChange={(val) => {
                setStatusFilter(val === "__all" ? "" : val as ProductStatus);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value || "__all"} value={opt.value || "__all"}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Categoria
            </label>
            <Input
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              placeholder="Filtrar por categoria"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Marca
            </label>
            <Input
              value={brandFilter}
              onChange={(e) => {
                setBrandFilter(e.target.value);
                setPage(1);
              }}
              placeholder="Filtrar por marca"
              className="h-9"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <DataTable<ProductRow>
        columns={columns}
        data={products}
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
        searchPlaceholder="Buscar por nome ou SKU..."
        exportCsv
        isLoading={isLoading}
      />

    </div>
  );
}
