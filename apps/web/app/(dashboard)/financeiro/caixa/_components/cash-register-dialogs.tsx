"use client";

import {  
  cashierSchema, type CashierFormValues, 
  movementSchema, type MovementFormValues,
  openSchema, type OpenFormValues,
  closeSchema, type CloseFormValues,
} from "@repo/validators";
import React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/forms/money-input";
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
import {
  useCreateCashRegister,
  useOpenCashRegister,
  useCloseCashRegister,
  useCashSupply,
  useCashWithdraw,
} from "@/hooks/use-cash-registers";
import { useFinancialAccounts } from "@/hooks/use-financial-accounts";
import { useToast } from "@/components/ui/toast";
import { Loader2 } from "lucide-react";
import type { CashRegister } from "@/hooks/use-cash-registers";

// ─── Coerce helper ─────────────────────────────────────────────────────



// ─── Create Cash Register Dialog ───────────────────────────────────────

export function CreateCashRegisterDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mutation = useCreateCashRegister();
  const { data: accountsData } = useFinancialAccounts({ isActive: true });
  const { addToast } = useToast();

  const accounts = accountsData?.data ?? [];

  const { register, handleSubmit, control, reset, formState: { errors } } =
    useForm<CashierFormValues>({
      resolver: zodResolver(cashierSchema),
      defaultValues: { name: "", financialAccountId: "" },
    });

  React.useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const onSubmit = async (data: CashierFormValues) => {
    try {
      await mutation.mutateAsync(data);
      addToast("Caixa criado com sucesso!", "success");
      onOpenChange(false);
    } catch {
      addToast("Erro ao criar caixa. Tente novamente.", "error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Caixa</DialogTitle>
          <DialogDescription>Cadastre um novo caixa no sistema.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nome *</label>
            <Input {...register("name")} placeholder="Ex: Caixa 01" maxLength={100} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Conta Financeira *</label>
            <Controller
              name="financialAccountId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.financialAccountId && (
              <p className="text-xs text-destructive">{errors.financialAccountId.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Open Session Dialog ───────────────────────────────────────────────

export function OpenSessionDialog({
  register: reg,
  onClose,
}: {
  register: CashRegister | null;
  onClose: () => void;
}) {
  const mutation = useOpenCashRegister();
  const { addToast } = useToast();

  const { handleSubmit, control, reset } = useForm<OpenFormValues>({
    resolver: zodResolver(openSchema),
    defaultValues: { openingBalance: 0 },
  });

  React.useEffect(() => {
    if (reg) reset({ openingBalance: 0 });
  }, [reg, reset]);

  const onSubmit = async (data: OpenFormValues) => {
    if (!reg) return;
    try {
      await mutation.mutateAsync({ id: reg.id, openingBalance: data.openingBalance });
      addToast("Caixa aberto com sucesso!", "success");
      onClose();
    } catch {
      addToast("Erro ao abrir caixa. Tente novamente.", "error");
    }
  };

  return (
    <Dialog open={!!reg} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir Caixa - {reg?.name}</DialogTitle>
          <DialogDescription>Informe o saldo de abertura.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <MoneyInput name="openingBalance" control={control} label="Saldo de Abertura" />
          <DialogFooter>
            <Button type="button" variant="cancel" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Abrir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Close Session Dialog ──────────────────────────────────────────────

export function CloseSessionDialog({
  register: reg,
  onClose,
}: {
  register: CashRegister | null;
  onClose: () => void;
}) {
  const mutation = useCloseCashRegister();
  const { addToast } = useToast();

  const { register: formRegister, handleSubmit, control, reset, formState: {errors} } =
    useForm<CloseFormValues>({
      resolver: zodResolver(closeSchema),
      defaultValues: { closingBalance: 0, notes: "" },
    });

  React.useEffect(() => {
    if (reg) reset({ closingBalance: 0, notes: "" });
  }, [reg, reset]);

  const onSubmit = async (data: CloseFormValues) => {
    if (!reg) return;
    try {
      await mutation.mutateAsync({
        id: reg.id,
        closingBalance: data.closingBalance,
        notes: data.notes || undefined,
      });
      addToast("Caixa fechado com sucesso!", "success");
      onClose();
    } catch {
      addToast("Erro ao fechar caixa. Tente novamente.", "error");
    }
  };

  return (
    <Dialog open={!!reg} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fechar Caixa - {reg?.name}</DialogTitle>
          <DialogDescription>Informe o saldo contado e observacoes.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <MoneyInput name="closingBalance" control={control} label="Saldo Contado" />
          <div className="space-y-1">
            <label className="text-sm font-medium">Observacoes</label>
            <textarea
              {...formRegister("notes")}
              rows={3}
              placeholder="Observacoes sobre o fechamento..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            {errors.notes && (
              <p className="text-xs text-destructive">{errors.notes.message}</p>)}
          </div>
          <DialogFooter>
            <Button type="button" variant="cancel" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="destructive" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Fechar Caixa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Supply / Withdraw Dialog ──────────────────────────────────────────

export function MovementDialog({
  register: reg,
  type,
  onClose,
}: {
  register: CashRegister | null;
  type: "supply" | "withdraw";
  onClose: () => void;
}) {
  const supplyMutation = useCashSupply();
  const withdrawMutation = useCashWithdraw();
  const { addToast } = useToast();

  const mutation = type === "supply" ? supplyMutation : withdrawMutation;
  const title = type === "supply" ? "Suprimento" : "Sangria";

  const { register: formRegister, handleSubmit, control, reset, formState: { errors } } =
    useForm<MovementFormValues>({
      resolver: zodResolver(movementSchema),
      defaultValues: { amount: 0, reason: "" },
    });

  React.useEffect(() => {
    if (reg) reset({ amount: 0, reason: "" });
  }, [reg, reset]);

  const onSubmit = async (data: MovementFormValues) => {
    if (!reg) return;
    try {
      await mutation.mutateAsync({ id: reg.id, ...data });
      addToast(`${title} realizado com sucesso!`, "success");
      onClose();
    } catch {
      addToast(`Erro ao realizar ${title.toLowerCase()}. Tente novamente.`, "error");
    }
  };

  return (
    <Dialog open={!!reg} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title} - {reg?.name}</DialogTitle>
          <DialogDescription>
            {type === "supply"
              ? "Adicione dinheiro ao caixa."
              : "Retire dinheiro do caixa."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <MoneyInput name="amount" control={control} label="Valor *" />
          <div className="space-y-1">
            <label className="text-sm font-medium">Motivo *</label>
            <Input {...formRegister("reason")} placeholder="Motivo da movimentacao"/>
            {errors.reason && <p className="text-xs text-destructive">{errors.reason.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="cancel" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
