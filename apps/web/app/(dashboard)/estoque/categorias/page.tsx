"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { CategoryFormDialog } from "@/components/forms/category-form-dialog";
import {
  DataTable,
  type ColumnDef,
  type SortState,
} from "@/components/tables/data-table";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "@/hooks/use-products";
import type { CategoryRow, CategoryFormData } from "@/hooks/use-products";
import {
  Plus,
  Edit,
  Trash2,
  FolderTree,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Flatten tree with depth ────────────────────────────────────────

interface FlatCategory extends CategoryRow {
  depth: number;
}

function flattenCategories(
  categories: CategoryRow[],
  parentId: string | null = null,
  depth = 0
): FlatCategory[] {
  const result: FlatCategory[] = [];
  const children = categories.filter((c) => (c.parentId ?? null) === parentId);
  for (const child of children) {
    result.push({ ...child, depth });
    result.push(...flattenCategories(categories, child.id, depth + 1));
  }
  return result;
}

// ─── Actions cell ───────────────────────────────────────────────────

function CategoryActions({
  category,
  onEdit,
  onDelete,
}: {
  category: FlatCategory;
  onEdit: (cat: FlatCategory) => void;
  onDelete: (cat: FlatCategory) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Tooltip content="Editar">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onEdit(category)}
        >
          <Edit className="h-4 w-4" />
        </Button>
      </Tooltip>
      <Tooltip content="Excluir">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => onDelete(category)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </Tooltip>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const { addToast } = useToast();

  // Data
  const { data, isLoading } = useCategories();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  // State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editCategory, setEditCategory] = useState<FlatCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FlatCategory | null>(null);

  const allCategories = (data?.data ?? []) as CategoryRow[];

  const flatCategories = useMemo(
    () => flattenCategories(allCategories),
    [allCategories]
  );

  const filtered = useMemo(() => {
    if (!search) return flatCategories;
    const q = search.toLowerCase();
    return flatCategories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q)
    );
  }, [flatCategories, search]);

  const total = filtered.length;
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  // Handlers
  const handleEdit = (cat: FlatCategory) => {
    setEditCategory(cat);
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditCategory(null);
    setShowForm(true);
  };

  const handleFormSubmit = async (values: CategoryFormData) => {
    const payload = {
      ...values,
      parentId: values.parentId || undefined,
    };

    try {
      if (editCategory) {
        await updateMutation.mutateAsync({ id: editCategory.id, ...payload });
        addToast("Categoria atualizada com sucesso!", "success");
      } else {
        await createMutation.mutateAsync(payload);
        addToast("Categoria criada com sucesso!", "success");
      }
      setShowForm(false);
      setEditCategory(null);
    } catch {
      addToast(
        editCategory
          ? "Erro ao atualizar categoria."
          : "Erro ao criar categoria.",
        "error"
      );
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      addToast("Categoria excluída com sucesso!", "success");
      setDeleteTarget(null);
    } catch {
      addToast("Erro ao excluir categoria.", "error");
    }
  };

  // Columns
  const columns: ColumnDef<FlatCategory>[] = [
    {
      id: "name",
      header: "Nome",
      accessor: "name",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-1" style={{ paddingLeft: `${row.depth * 24}px` }}>
          {row.depth > 0 && (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          )}
          <FolderTree className={cn(
            "mr-1.5 h-4 w-4 shrink-0",
            row.depth === 0 ? "text-primary" : "text-muted-foreground"
          )} />
          <span className={cn("font-medium", row.depth === 0 && "text-foreground")}>
            {row.name}
          </span>
        </div>
      ),
    },
    {
      id: "slug",
      header: "Slug",
      accessor: "slug",
      className: "font-mono text-xs text-muted-foreground",
    },
    {
      id: "parent",
      header: "Categoria Pai",
      accessor: (row) => row.parent?.name ?? "-",
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
        <CategoryActions
          category={row}
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
          <h1 className="text-3xl font-bold tracking-tight">Categorias</h1>
          <p className="text-muted-foreground">
            Gerencie as categorias de produtos
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Categoria
        </Button>
      </div>

      {/* Table */}
      <DataTable<FlatCategory>
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
        searchPlaceholder="Buscar categorias..."
        isLoading={isLoading}
        emptyMessage="Nenhuma categoria encontrada"
        emptyDescription="Crie sua primeira categoria clicando no botão acima."
      />

      {/* Form dialog */}
      <CategoryFormDialog
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditCategory(null);
        }}
        category={editCategory}
        categories={allCategories}
        loading={createMutation.isPending || updateMutation.isPending}
        onSubmit={handleFormSubmit}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Excluir Categoria"
        message={`Deseja excluir "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
        destructive
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
