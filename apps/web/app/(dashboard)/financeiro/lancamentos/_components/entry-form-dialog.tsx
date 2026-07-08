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
import { useToast } from "@/components/ui/toast";
import { useFinancialAccounts } from "@/hooks/use-financial-accounts";
import { useChartOfAccounts } from "@/hooks/use-chart-of-accounts";
import { useCreateFinancialEntry } from "@/hooks/use-financial-entries";
import { Loader2 } from "lucide-react";

const entrySchema = z
  .object({
    type: z.enum(["REVENUE", "EXPENSE"]),
    accountId: z.string().min(1, "Conta obrigatória"),
    chartAccountId: z.string().optional(),
    amount: z.coerce.number().positive("Valor deve ser maior que zero"),
    date: z.string().min(1, "Data obrigatória"),
    paid: z.boolean().default(true),
    dueDate: z.string().optional(),
    description: z.string().max(255).optional(),
  })
  .refine((d) => d.paid || (!!d.dueDate && d.dueDate.length > 0), {
    message: "Vencimento obrigatório para lançamento a prazo",
    path: ["dueDate"],
  });

type EntryFormValues = z.infer<typeof entrySchema>;

const DEFAULTS: EntryFormValues = {
  type: "EXPENSE",
  accountId: "",
  chartAccountId: "",
  amount: 0,
  date: new Date().toISOString().slice(0, 10),
  paid: true,
  dueDate: "",
  description: "",
};

export interface EntryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EntryFormDialog({ open, onOpenChange }: EntryFormDialogProps) {
  const { data: accountsData } = useFinancialAccounts({ isActive: true });
  const { data: categories } = useChartOfAccounts();
  const createMutation = useCreateFinancialEntry();
  const { addToast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<EntryFormValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (open) reset(DEFAULTS);
  }, [open, reset]);

  const accounts = accountsData?.data ?? [];
  const isPaid = watch("paid");

  const onSubmit = async (values: EntryFormValues) => {
    try {
      await createMutation.mutateAsync({
        type: values.type,
        accountId: values.accountId,
        chartAccountId: values.chartAccountId || undefined,
        amount: values.amount,
        date: values.date,
        paid: values.paid,
        dueDate: values.paid ? undefined : values.dueDate,
        description: values.description || undefined,
      });
      addToast("Lançamento criado com sucesso!", "success");
      onOpenChange(false);
    } catch {
      addToast("Erro ao criar lançamento. Tente novamente.", "error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Lançamento</DialogTitle>
          <DialogDescription>
            Registre uma despesa ou receita manual.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Tipo *</label>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EXPENSE">Despesa</SelectItem>
                      <SelectItem value="REVENUE">Receita</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Valor *</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                {...register("amount")}
              />
              {errors.amount && (
                <p className="text-xs text-destructive">{errors.amount.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Conta *</label>
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
            {errors.accountId && (
              <p className="text-xs text-destructive">{errors.accountId.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Categoria</label>
            <Controller
              name="chartAccountId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || "none"}
                  onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {(categories ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Data *</label>
              <Input type="date" {...register("date")} />
              {errors.date && (
                <p className="text-xs text-destructive">{errors.date.message}</p>
              )}
            </div>
            {!isPaid && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Vencimento *</label>
                <Input type="date" {...register("dueDate")} />
                {errors.dueDate && (
                  <p className="text-xs text-destructive">{errors.dueDate.message}</p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Descrição</label>
            <Input
              {...register("description")}
              placeholder="Ex: Aluguel da loja"
              maxLength={255}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              {...register("paid")}
              className="h-4 w-4 rounded border-input"
            />
            À vista (atualiza o saldo da conta imediatamente)
          </label>

          <DialogFooter>
            <Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
