"use client";

import React from "react";
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
import {
  useCreateMovement,
  useWarehouses,
  type MovementType,
  type MovementReason,
  type CreateMovementPayload,
} from "@/hooks/use-inventory";
import { useProducts } from "@/hooks/use-products";
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

const schema = z.object({
  type: z.enum(["ENTRY", "EXIT"]),
  productId: z.string().min(1, "Selecione um produto"),
  warehouseId: z.string().min(1, "Selecione um depósito"),
  quantity: z.coerce.number().int().min(1, "Quantidade deve ser ao menos 1"),
  reason: z.string().min(1, "Selecione um motivo"),
  notes: z.string().max(500).optional(),
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
  const { data: productsResp } = useProducts({ limit: 100 });

  const warehouses = warehousesResp?.data ?? [];
  const products = productsResp?.data ?? [];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
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
    } catch {
      addToast("Erro ao registrar movimentação. Verifique o estoque e tente novamente.", "error");
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
            <Select
              value={watch("productId")}
              onValueChange={(v) => setValue("productId", v, { shouldValidate: true })}
            >
              <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.productId && <p className="text-xs text-destructive">{errors.productId.message}</p>}
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
