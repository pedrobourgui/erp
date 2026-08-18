"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";

import { MoneyInput } from "@/components/forms/money-input";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/components/ui/toast";
import { useFinancialAccounts } from "@/hooks/use-financial-accounts";
import {
  useSettleFinancialEntry,
  type FinancialEntry,
} from "@/hooks/use-financial-entries";
import { getApiErrorMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";


const settleSchema = z.object({
  amount: z.coerce.number().positive("Valor deve ser maior que zero"),
  accountId: z.string().min(1, "Conta obrigatória"),
});

type SettleFormValues = z.infer<typeof settleSchema>;

export interface SettleEntryDialogProps {
  entry: FinancialEntry | null;
  onOpenChange: (open: boolean) => void;
}

export function SettleEntryDialog({ entry, onOpenChange }: SettleEntryDialogProps) {
  const { data: accountsData } = useFinancialAccounts({ isActive: true });
  const settleMutation = useSettleFinancialEntry();
  const { addToast } = useToast();

  const {
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<SettleFormValues>({
    resolver: zodResolver(settleSchema),
    defaultValues: { amount: 0, accountId: "" },
  });

  // `entry.amount` is what is still open, so it is the natural default
  useEffect(() => {
    if (entry) {
      reset({ amount: entry.amount, accountId: entry.accountId ?? "" });
    }
  }, [entry, reset]);

  const accounts = accountsData?.data ?? [];
  const isReceivable = entry?.kind === "RECEIVABLE";

  const onSubmit = async (values: SettleFormValues) => {
    if (!entry) {
      return;
    }
    try {
      await settleMutation.mutateAsync({
        id: entry.id,
        kind: isReceivable ? "RECEIVABLE" : "PAYABLE",
        amount: values.amount,
        accountId: values.accountId,
      });
      addToast(
        isReceivable ? "Recebimento registrado!" : "Pagamento registrado!",
        "success"
      );
      onOpenChange(false);
    } catch (err) {
      addToast(
        getApiErrorMessage(err) ?? "Erro ao registrar a baixa. Tente novamente.",
        "error"
      );
    }
  };

  return (
    <Dialog open={entry !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isReceivable ? "Registrar recebimento" : "Registrar pagamento"}
          </DialogTitle>
          <DialogDescription>
            {entry?.description} — saldo em aberto de{" "}
            {formatCurrency(entry?.amount ?? 0)}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4"
          noValidate
        >
          <MoneyInput
            name="amount"
            control={control}
            label="Valor da baixa"
            error={errors.amount?.message}
          />

          <div className="space-y-1">
            <label className="text-sm font-medium">
              Conta {isReceivable ? "creditada" : "debitada"} *
            </label>
            <Controller
              name="accountId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.accountId ? <p className="text-xs text-destructive">{errors.accountId.message}</p> : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="cancel"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="success" disabled={settleMutation.isPending}>
              {settleMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar baixa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
