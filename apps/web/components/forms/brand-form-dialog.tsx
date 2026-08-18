"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { BrandRow } from "@/hooks/use-products";

// ─── Schema ─────────────────────────────────────────────────────────

const brandSchema = z.object({
  name: z
    .string()
    .min(1, "Nome é obrigatório")
    .max(255, "Nome deve ter no máximo 255 caracteres"),
  logoUrl: z
    .string()
    .url("URL inválida")
    .max(500, "URL deve ter no máximo 500 caracteres")
    .optional()
    .or(z.literal("")),
});

type BrandFormValues = z.infer<typeof brandSchema>;

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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4"
          noValidate
        >
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nome *</label>
            <Input
              {...register("name")}
              placeholder="Ex: Samsung"
              maxLength={255}
              autoFocus
            />
            {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">URL do Logo</label>
            <Input
              {...register("logoUrl")}
              placeholder="https://exemplo.com/logo.png"
              maxLength={500}
            />
            {errors.logoUrl ? <p className="text-xs text-destructive">
                {errors.logoUrl.message}
              </p> : null}
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
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEdit ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
