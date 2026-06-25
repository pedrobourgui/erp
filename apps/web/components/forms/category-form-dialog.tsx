"use client";

import React, { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { categorySchema, type CategoryFormValues} from "@repo/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryRow } from "@/hooks/use-products";

// ─── Props ──────────────────────────────────────────────────────────

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: CategoryRow | null;
  categories: CategoryRow[];
  loading?: boolean;
  onSubmit: (values: CategoryFormValues) => void;
}

// ─── Slug helper ────────────────────────────────────────────────────

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─── Component ──────────────────────────────────────────────────────

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  categories,
  loading = false,
  onSubmit,
}: CategoryFormDialogProps) {
  const isEdit = !!category;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      slug: "",
      parentId: null,
    },
  });

  const nameValue = watch("name");

  useEffect(() => {
    if (open) {
      if (category) {
        reset({
          name: category.name,
          slug: category.slug,
          parentId: category.parentId ?? null,
        });
      } else {
        reset({ name: "", slug: "", parentId: null });
      }
    }
  }, [open, category, reset]);

  useEffect(() => {
    if (!isEdit && nameValue) {
      setValue("slug", generateSlug(nameValue));
    }
  }, [nameValue, isEdit, setValue]);

  const parentOptions = useMemo(() => {
    if (!category) return categories;
    return categories.filter((c) => c.id !== category.id);
  }, [categories, category]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar Categoria" : "Nova Categoria"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Altere os dados da categoria."
              : "Preencha os dados para criar uma nova categoria."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nome *</label>
            <Input
              {...register("name")}
              placeholder="Ex: Eletrônicos"
              autoFocus
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Slug</label>
            <Input
              {...register("slug")}
              placeholder="ex: eletronicos"
            />
            {errors.slug && (
              <p className="text-xs text-destructive">{errors.slug.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Gerado automaticamente a partir do nome.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Categoria Pai</label>
            <Select
              value={watch("parentId") || "__none"}
              onValueChange={(val) => setValue("parentId", val === "__none" ? null : val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nenhuma (raiz)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Nenhuma (raiz)</SelectItem>
                {parentOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="cancel"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
