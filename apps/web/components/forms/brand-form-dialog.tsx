"use client";

import { brandSchema, type BrandFormValues } from "@repo/validators";
import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import type { BrandRow } from "@/hooks/use-products";

// ─── Props ──────────────────────────────────────────────────────────

interface BrandFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand?: BrandRow | null;
  loading?: boolean;
  onSubmit: (values: BrandFormValues) => void;
}

// ─── Component ──────────────────────────────────────────────────────

export function BrandFormDialog({
  open,
  onOpenChange,
  brand,
  loading = false,
  onSubmit,
}: BrandFormDialogProps) {
  const isEdit = !!brand;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BrandFormValues>({
    resolver: zodResolver(brandSchema),
    defaultValues: {
      name: "",
      logoUrl: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (brand) {
        reset({ name: brand.name, logoUrl: brand.logoUrl ?? "" });
      } else {
        reset({ name: "", logoUrl: "" });
      }
    }
  }, [open, brand, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar Marca" : "Nova Marca"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Altere os dados da marca."
              : "Preencha os dados para criar uma nova marca."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nome *</label>
            <Input
              {...register("name")}
              placeholder="Ex: Samsung"
              maxLength={255}
              autoFocus
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">URL do Logo</label>
            <Input
              {...register("logoUrl")}
              placeholder="https://exemplo.com/logo.png"
              maxLength={500}
            />
            {errors.logoUrl && (
              <p className="text-xs text-destructive">
                {errors.logoUrl.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              URL da imagem do logotipo da marca (opcional).
            </p>
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
