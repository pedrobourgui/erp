"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { MoneyInput } from "@/components/forms/money-input";
import { useToast } from "@/components/ui/toast";
import { getApiErrorMessage } from "@/lib/api";
import { useCreateAccountTransfer } from "@/hooks/use-account-transfers";
import type { FinancialAccount } from "@/hooks/use-financial-accounts";
import { Loader2, ArrowRightLeft } from "lucide-react";

// ─── Schema ───────────────────────────────────────────────────────────

const transferSchema = z
  .object({
    fromAccountId: z.string().min(1, "Selecione a conta de origem"),
    toAccountId: z.string().min(1, "Selecione a conta de destino"),
    amount: z.number().positive("O valor deve ser maior que zero"),
    date: z.string().optional(),
    description: z.string().max(255).optional().or(z.literal("")),
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: "Origem e destino devem ser diferentes",
    path: ["toAccountId"],
  });

type TransferFormValues = z.infer<typeof transferSchema>;

type TransferDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: FinancialAccount[];
};

// ─── Component ────────────────────────────────────────────────────────

export function TransferDialog({ open, onOpenChange, accounts }: TransferDialogProps) {
  const transferMutation = useCreateAccountTransfer();
  const { addToast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      fromAccountId: "",
      toAccountId: "",
      amount: 0,
      date: "",
      description: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({ fromAccountId: "", toAccountId: "", amount: 0, date: "", description: "" });
    }
  }, [open, reset]);

  const onSubmit = async (data: TransferFormValues) => {
    try {
      await transferMutation.mutateAsync({
        fromAccountId: data.fromAccountId,
        toAccountId: data.toAccountId,
        amount: data.amount,
        date: data.date || undefined,
        description: data.description || undefined,
      });
      addToast("Transferência realizada com sucesso!", "success");
      onOpenChange(false);
    } catch (error) {
      addToast(
        getApiErrorMessage(error) ?? "Erro ao realizar a transferência. Tente novamente.",
        "error"
      );
    }
  };

  const activeAccounts = accounts.filter((a) => a.isActive);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transferência entre contas
          </DialogTitle>
          <DialogDescription>
            Debita a conta de origem e credita a conta de destino, atualizando os
            saldos de forma atômica.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Conta de origem *</label>
              <Controller
                name="fromAccountId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.fromAccountId && (
                <p className="text-xs text-destructive">{errors.fromAccountId.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Conta de destino *</label>
              <Controller
                name="toAccountId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.toAccountId && (
                <p className="text-xs text-destructive">{errors.toAccountId.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyInput
              name="amount"
              control={control}
              label="Valor *"
              error={errors.amount?.message}
            />
            <div className="space-y-1">
              <label className="text-sm font-medium">Data</label>
              <Input type="date" {...register("date")} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Descrição</label>
            <Input
              {...register("description")}
              placeholder="Ex: Transferência para conta corrente"
              maxLength={255}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={transferMutation.isPending}>
              {transferMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Transferir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
