"use client";

import React, { useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { SearchableSelect } from "@/components/forms/searchable-select";
import {
  useCreateMovement,
  useWarehouses,
  type MovementType,
  type MovementReason,
  type CreateMovementPayload,
} from "@/hooks/use-inventory";
import api, { getApiErrorMessage } from "@/lib/api";
import type { PaginatedResponse } from "@erp/shared-types";
import { Loader2 } from "lucide-react";

// Only manual add/remove is exposed here (transfers/adjustments have their own flows)
const MOVEMENT_TYPES: { value: "ENTRY" | "EXIT"; label: string }[] = [
  { value: "ENTRY", label: "Entrada (adicionar)" },
  { value: "EXIT", label: "Saída (remover)" },
];

const REASONS_BY_TYPE: Record<"ENTRY" | "EXIT", { value: MovementReason; label: string }[]> = {
  ENTRY: [
    { value: "PURCHASE", label: "Compra" },
    { value: "RETURN_CUSTOMER", label: "Devolução de cliente" },
    { value: "PRODUCTION", label: "Produção" },
    { value: "INITIAL", label: "Saldo inicial" },
    { value: "COUNT", label: "Inventário/Contagem" },
  ],
  EXIT: [
    { value: "SALE", label: "Venda" },
    { value: "RETURN_SUPPLIER", label: "Devolução a fornecedor" },
    { value: "DAMAGE", label: "Avaria" },
    { value: "THEFT", label: "Furto/Perda" },
    { value: "COUNT", label: "Inventário/Contagem" },
  ],
};

const schema = z
  .object({
    type: z.enum(["ENTRY", "EXIT"]),
    productId: z.string().min(1, "Selecione um produto"),
    warehouseId: z.string().min(1, "Selecione um depósito"),
    quantity: z.coerce
      .number()
      .int("Quantidade deve ser um número inteiro")
      .min(1, "Quantidade deve ser ao menos 1")
      .max(1_000_000, "Quantidade acima do limite permitido"),
    reason: z.string().min(1, "Selecione um motivo"),
    notes: z.string().max(500).optional(),
  })
  .superRefine((values, ctx) => {
    // Reason must match the selected movement type (ENTRY vs EXIT reasons differ)
    const allowed = REASONS_BY_TYPE[values.type].map((r) => r.value as string);
    if (values.reason && !allowed.includes(values.reason)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Motivo incompatível com o tipo de movimentação",
      });
    }
  });

type FormValues = z.infer<typeof schema>;

interface MovementFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MovementFormDialog({ open, onOpenChange }: MovementFormDialogProps) {
  const { addToast } = useToast();
  const createMovement = useCreateMovement();
  const { data: warehousesResp } = useWarehouses();

  const warehouses = warehousesResp?.data ?? [];

  // Server-side product search so the picker isn't capped at the first 100 items
  const loadProducts = useCallback(async (search: string) => {
    const { data } = await api.get<
      PaginatedResponse<{ id: string; name: string; sku: string }>
    >("/products", { params: { search, limit: 20, status: "ACTIVE" } });
    return (data.data ?? []).map((p) => ({
      value: p.id,
      label: p.name,
      description: p.sku,
    }));
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "ENTRY", productId: "", warehouseId: "", quantity: 1, reason: "" },
  });

  const type = watch("type") as "ENTRY" | "EXIT";

  const onSubmit = async (values: FormValues) => {
    const payload: CreateMovementPayload = {
      productId: values.productId,
      type: values.type as MovementType,
      reason: values.reason as MovementReason,
      quantity: values.quantity,
      notes: values.notes || undefined,
      ...(values.type === "ENTRY"
        ? { toWarehouseId: values.warehouseId }
        : { fromWarehouseId: values.warehouseId }),
    };

    try {
      await createMovement.mutateAsync(payload);
      addToast("Movimentação registrada com sucesso!", "success");
      reset();
      onOpenChange(false);
    } catch (err) {
      addToast(
        getApiErrorMessage(err) ??
          "Erro ao registrar movimentação. Verifique o estoque e tente novamente.",
        "error"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova movimentação</DialogTitle>
          <DialogDescription>
            Adicione ou remova produtos do estoque de um depósito.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tipo</label>
            <Select
              value={type}
              onValueChange={(v) => {
                setValue("type", v as "ENTRY" | "EXIT", { shouldValidate: true });
                setValue("reason", "", { shouldValidate: false });
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOVEMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Produto</label>
            <SearchableSelect
              name="productId"
              control={control}
              loadOptions={loadProducts}
              placeholder="Selecione o produto"
              error={errors.productId?.message}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Depósito</label>
            <Select
              value={watch("warehouseId")}
              onValueChange={(v) => setValue("warehouseId", v, { shouldValidate: true })}
            >
              <SelectTrigger><SelectValue placeholder="Selecione o depósito" /></SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.warehouseId && <p className="text-xs text-destructive">{errors.warehouseId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Quantidade</label>
              <Input type="number" min={1} {...register("quantity")} />
              {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Motivo</label>
              <Select
                value={watch("reason")}
                onValueChange={(v) => setValue("reason", v, { shouldValidate: true })}
              >
                <SelectTrigger><SelectValue placeholder="Motivo" /></SelectTrigger>
                <SelectContent>
                  {REASONS_BY_TYPE[type].map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.reason && <p className="text-xs text-destructive">{errors.reason.message}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Observações</label>
            <Input maxLength={500} {...register("notes")} placeholder="Opcional" />
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMovement.isPending}>
              {createMovement.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
