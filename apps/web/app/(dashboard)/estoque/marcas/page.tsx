"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { BrandFormDialog } from "@/components/forms/brand-form-dialog";
import {
  DataTable,
  type ColumnDef,
  type SortState,
} from "@/components/tables/data-table";
import {
  useBrands,
  useCreateBrand,
  useUpdateBrand,
  useDeleteBrand,
} from "@/hooks/use-products";
import type { BrandRow, BrandFormData } from "@/hooks/use-products";
import { Plus, Edit, Trash2, ImageIcon } from "lucide-react";

// ─── Actions cell ───────────────────────────────────────────────────

function BrandActions({
  brand,
  onEdit,
  onDelete,
}: {
  brand: BrandRow;
  onEdit: (b: BrandRow) => void;
  onDelete: (b: BrandRow) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Tooltip content="Editar">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onEdit(brand)}
        >
          <Edit className="h-4 w-4" />
        </Button>
      </Tooltip>
      <Tooltip content="Excluir">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => onDelete(brand)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </Tooltip>
    </div>
  );
}

// ─── Brand logo cell ────────────────────────────────────────────────

function BrandLogo({ brand }: { brand: BrandRow }) {
  if (!brand.logoUrl) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-muted">
        <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <div className="relative h-8 w-8 overflow-hidden rounded-md border bg-white">
      <Image
        src={brand.logoUrl}
        alt={brand.name}
        fill
        className="object-contain p-0.5"
        sizes="32px"
      />
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────

export default function BrandsPage() {
  const { addToast } = useToast();

  // State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editBrand, setEditBrand] = useState<BrandRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BrandRow | null>(null);

  // Data
  const { data, isLoading } = useBrands({ search: search || undefined });
  const createMutation = useCreateBrand();
  const updateMutation = useUpdateBrand();
  const deleteMutation = useDeleteBrand();

  const brands = (data?.data ?? []) as BrandRow[];
  const total = brands.length;
  const paginated = brands.slice((page - 1) * limit, page * limit);

  // Handlers
  const handleEdit = (b: BrandRow) => {
    setEditBrand(b);
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditBrand(null);
    setShowForm(true);
  };

  const handleFormSubmit = async (values: BrandFormData) => {
    const payload = {
      name: values.name,
      logoUrl: values.logoUrl || undefined,
    };

    try {
      if (editBrand) {
        await updateMutation.mutateAsync({ id: editBrand.id, ...payload });
        addToast("Marca atualizada com sucesso!", "success");
      } else {
        await createMutation.mutateAsync(payload);
        addToast("Marca criada com sucesso!", "success");
      }
      setShowForm(false);
      setEditBrand(null);
    } catch {
      addToast(
        editBrand ? "Erro ao atualizar marca." : "Erro ao criar marca.",
        "error"
      );
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      addToast("Marca excluída com sucesso!", "success");
      setDeleteTarget(null);
    } catch {
      addToast("Erro ao excluir marca.", "error");
    }
  };

  // Columns
  const columns: ColumnDef<BrandRow>[] = [
    {
      id: "logo",
      header: "",
      cell: (row) => <BrandLogo brand={row} />,
      className: "w-[56px]",
    },
    {
      id: "name",
      header: "Nome",
      accessor: "name",
      sortable: true,
      cell: (row) => (
        <span className="font-medium">{row.name}</span>
      ),
    },
    {
      id: "products",
      header: "Produtos",
      accessor: (row) => row._count?.products ?? 0,
      sortable: true,
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      id: "actions",
      header: "Ações",
      cell: (row) => (
        <BrandActions
          brand={row}
          onEdit={handleEdit}
          onDelete={setDeleteTarget}
        />
      ),
      className: "text-right w-[100px]",
      headerClassName: "text-right",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marcas</h1>
          <p className="text-muted-foreground">
            Gerencie as marcas de produtos
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Marca
        </Button>
      </div>

      {/* Table */}
      <DataTable<BrandRow>
        columns={columns}
        data={paginated}
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
        searchPlaceholder="Buscar marcas..."
        isLoading={isLoading}
        emptyMessage="Nenhuma marca encontrada"
        emptyDescription="Crie sua primeira marca clicando no botão acima."
      />

      {/* Form dialog */}
      <BrandFormDialog
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditBrand(null);
        }}
        brand={editBrand}
        loading={createMutation.isPending || updateMutation.isPending}
        onSubmit={handleFormSubmit}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Excluir Marca"
        message={`Deseja excluir "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
        destructive
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
