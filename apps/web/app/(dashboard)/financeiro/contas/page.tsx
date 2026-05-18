"use client";

import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  useFinancialAccounts,
  useCreateFinancialAccount,
  useUpdateFinancialAccount,
  type FinancialAccount,
  type BankAccountType,
} from "@/hooks/use-financial-accounts";
import { useToast } from "@/components/ui/toast";
import { Plus, Pencil, Loader2, Building2, Wallet, Landmark, Smartphone } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: BankAccountType; label: string }[] = [
  { value: "CASH", label: "Caixa" },
  { value: "CHECKING", label: "Conta Corrente" },
  { value: "SAVINGS", label: "Poupanca" },
  { value: "DIGITAL", label: "Conta Digital" },
];

const TYPE_LABELS: Record<BankAccountType, string> = {
  CASH: "Caixa",
  CHECKING: "Conta Corrente",
  SAVINGS: "Poupanca",
  DIGITAL: "Conta Digital",
};

const TYPE_BADGE: Record<BankAccountType, "success" | "default" | "warning" | "secondary"> = {
  CASH: "success",
  CHECKING: "default",
  SAVINGS: "warning",
  DIGITAL: "secondary",
};

const TYPE_ICON: Record<BankAccountType, React.ElementType> = {
  CASH: Wallet,
  CHECKING: Landmark,
  SAVINGS: Building2,
  DIGITAL: Smartphone,
};

// ─── Schema ───────────────────────────────────────────────────────────

const accountSchema = z.object({
  name: z.string().min(1, "Nome obrigatorio").max(255),
  type: z.enum(["CHECKING", "SAVINGS", "CASH", "DIGITAL"]),
  code: z.string().max(20).optional().or(z.literal("")),
  bankName: z.string().max(255).optional().or(z.literal("")),
  bankBranch: z.string().max(255).optional().or(z.literal("")),
  bankAccount: z.string().max(255).optional().or(z.literal("")),
  acceptsDirectSales: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

type AccountFormValues = z.infer<typeof accountSchema>;

// ─── Page ─────────────────────────────────────────────────────────────

export default function FinancialAccountsPage() {
  const { data, isLoading } = useFinancialAccounts();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialAccount | null>(null);

  const accounts = data?.data ?? [];

  const handleEdit = (account: FinancialAccount) => {
    setEditing(account);
    setFormOpen(true);
  };

  const handleCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Contas Financeiras
          </h1>
          <p className="text-muted-foreground">
            Gerencie suas contas bancarias e caixas
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Conta
        </Button>
      </div>

      <AccountsTable
        accounts={accounts}
        isLoading={isLoading}
        onEdit={handleEdit}
      />

      <AccountFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
      />
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────

function AccountsTable({
  accounts,
  isLoading,
  onEdit,
}: {
  accounts: FinancialAccount[];
  isLoading: boolean;
  onEdit: (a: FinancialAccount) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhuma conta financeira cadastrada
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nome</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Banco</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Saldo</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Venda Direta</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => {
                const Icon = TYPE_ICON[a.type];
                return (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{a.name}</span>
                        {a.code && (
                          <span className="text-xs text-muted-foreground">({a.code})</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={TYPE_BADGE[a.type]}>
                        {TYPE_LABELS[a.type]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {a.bankName ? (
                        <span>
                          {a.bankName}
                          {a.bankBranch && ` / Ag ${a.bankBranch}`}
                          {a.bankAccount && ` / CC ${a.bankAccount}`}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {Number(a.balance).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {a.acceptsDirectSales ? (
                        <Badge variant="success">Sim</Badge>
                      ) : (
                        <span className="text-muted-foreground">Nao</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={a.isActive ? "success" : "secondary"}>
                        {a.isActive ? "Ativa" : "Inativa"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEdit(a)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Form dialog ──────────────────────────────────────────────────────

function AccountFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: FinancialAccount | null;
}) {
  const createMutation = useCreateFinancialAccount();
  const updateMutation = useUpdateFinancialAccount();
  const { addToast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "",
      type: "CHECKING",
      code: "",
      bankName: "",
      bankBranch: "",
      bankAccount: "",
      acceptsDirectSales: false,
      isActive: true,
    },
  });

  const selectedType = watch("type");
  const showBankFields = selectedType === "CHECKING" || selectedType === "SAVINGS" || selectedType === "DIGITAL";

  React.useEffect(() => {
    if (open) {
      reset(
        editing
          ? {
              name: editing.name,
              type: editing.type,
              code: editing.code ?? "",
              bankName: editing.bankName ?? "",
              bankBranch: editing.bankBranch ?? "",
              bankAccount: editing.bankAccount ?? "",
              acceptsDirectSales: editing.acceptsDirectSales,
              isActive: editing.isActive,
            }
          : {
              name: "",
              type: "CHECKING",
              code: "",
              bankName: "",
              bankBranch: "",
              bankAccount: "",
              acceptsDirectSales: false,
              isActive: true,
            }
      );
    }
  }, [open, editing, reset]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = async (data: AccountFormValues) => {
    const payload = {
      ...data,
      code: data.code || undefined,
      bankName: data.bankName || undefined,
      bankBranch: data.bankBranch || undefined,
      bankAccount: data.bankAccount || undefined,
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...payload });
        addToast("Conta atualizada com sucesso!", "success");
      } else {
        await createMutation.mutateAsync(payload);
        addToast("Conta criada com sucesso!", "success");
      }
      onOpenChange(false);
    } catch {
      addToast(
        editing
          ? "Erro ao atualizar conta. Tente novamente."
          : "Erro ao criar conta. Tente novamente.",
        "error"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Conta" : "Nova Conta"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Atualize os dados da conta financeira."
              : "Preencha os dados para criar uma nova conta financeira."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nome *</label>
              <Input
                {...register("name")}
                placeholder="Ex: Santander"
                maxLength={255}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Tipo *</label>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Codigo interno</label>
            <Input
              {...register("code")}
              placeholder="Ex: 001"
              maxLength={20}
            />
          </div>

          {showBankFields && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Banco</label>
                <Input
                  {...register("bankName")}
                  placeholder="Ex: Santander"
                  maxLength={255}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Agencia</label>
                <Input
                  {...register("bankBranch")}
                  placeholder="Ex: 1234"
                  maxLength={255}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Conta</label>
                <Input
                  {...register("bankAccount")}
                  placeholder="Ex: 12345-6"
                  maxLength={255}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                {...register("acceptsDirectSales")}
                className="h-4 w-4 rounded border-input"
              />
              Aceita venda direta
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                {...register("isActive")}
                className="h-4 w-4 rounded border-input"
              />
              Ativa
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
