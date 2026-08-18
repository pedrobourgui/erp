"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  useUpdateFinancialEntry,
  type FinancialEntry,
} from "@/hooks/use-financial-entries";
import { getApiErrorMessage } from "@/lib/api";
import { toDateInputValue } from "@/lib/utils";


const editSchema = z.object({
  description: z
    .string()
    .min(1, "Descrição é obrigatória")
    .max(255, "Máximo de 255 caracteres"),
  amount: z.coerce.number().positive("Valor deve ser maior que zero"),
  dueDate: z.string().min(1, "Vencimento é obrigatório"),
});

type EditFormValues = z.infer<typeof editSchema>;

interface EditEntryDialogProps {
  entry: FinancialEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * FN-04: edição de título.
 *
 * Com baixa registrada, valor e vencimento ficam travados — mexer neles depois
 * que dinheiro já entrou desalinha o título da transação que o liquidou. Para
 * mudá-los é preciso estornar a baixa primeiro, que é o que a API responde.
 */
export function EditEntryDialog({
  entry,
  open,
  onOpenChange,
}: EditEntryDialogProps) {
  const { addToast } = useToast();
  const update = useUpdateFinancialEntry();
  const hasSettlement =
    !!entry && ["PARTIALLY_PAID", "PAID"].includes(entry.status);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditFormValues>({ resolver: zodResolver(editSchema) });

  useEffect(() => {
    if (entry && open) {
      reset({
        description: entry.description,
        amount: entry.amount,
        dueDate: toDateInputValue(entry.date),
      });
    }
  }, [entry, open, reset]);

  const onSubmit = async (values: EditFormValues) => {
    if (!entry) {
      return;
    }
    try {
      await update.mutateAsync({
        id: entry.id,
        description: values.description,
        // Campos travados não são enviados: a API recusaria e o usuário veria
        // um erro por algo que a tela nem deixou editar.
        ...(hasSettlement
          ? {}
          : { amount: values.amount, dueDate: values.dueDate }),
      });
      addToast("Lançamento atualizado com sucesso!", "success");
      onOpenChange(false);
    } catch (err) {
      addToast(
        getApiErrorMessage(err) ??
          "Erro ao atualizar o lançamento. Tente novamente.",
        "error"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar lançamento</DialogTitle>
          <DialogDescription>
            {hasSettlement
              ? "Este título já tem baixa: só a descrição pode ser alterada. Estorne a baixa para mudar valor ou vencimento."
              : "Altere os dados do título."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4"
          noValidate
        >
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="edit-description">
              Descrição
            </label>
            <Input
              id="edit-description"
              maxLength={255}
              {...register("description")}
            />
            {errors.description ? <p className="text-xs text-destructive">
                {errors.description.message}
              </p> : null}
          </div>

          <MoneyInput
            name="amount"
            control={control}
            label="Valor"
            disabled={hasSettlement}
            error={errors.amount?.message}
          />

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="edit-due-date">
              Vencimento
            </label>
            <Input
              id="edit-due-date"
              type="date"
              disabled={hasSettlement}
              {...register("dueDate")}
            />
            {errors.dueDate ? <p className="text-xs text-destructive">{errors.dueDate.message}</p> : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
