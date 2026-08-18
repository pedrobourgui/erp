"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, Building2, Wallet, Landmark, Smartphone, ArrowRightLeft, Upload } from "lucide-react";
import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";

import { Can } from "@/components/auth/can";
import { RequirePermission } from "@/components/auth/require-permission";
import { ImportCsvDialog } from "@/components/forms/import-csv-dialog";
import { FilterField, FilterPanel } from "@/components/tables/filter-panel";
import { ListSearch } from "@/components/tables/list-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { TruncatedText } from "@/components/ui/truncated-text";
import { useFilters } from "@/hooks/use-filters";
import {
  useFinancialAccounts,
  useCreateFinancialAccount,
  useUpdateFinancialAccount,
  useDeleteFinancialAccount,
  type FinancialAccount,
  type BankAccountType,
} from "@/hooks/use-financial-accounts";
import { getMutationErrorMessage } from "@/lib/mutation-error";
import { formatCurrency } from "@/lib/utils";

import { TransferDialog } from "./_components/transfer-dialog";




// ─── Constants ────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: BankAccountType; label: string }[] = [
  { value: "CASH", label: "Caixa" },
  { value: "CHECKING", label: "Conta Corrente" },
  { value: "SAVINGS", label: "Poupança" },
  { value: "DIGITAL", label: "Conta Digital" },
];

const TYPE_LABELS: Record<BankAccountType, string> = {
  CASH: "Caixa",
  CHECKING: "Conta Corrente",
  SAVINGS: "Poupança",
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
  name: z.string().min(1, "Nome obrigatório").max(255),
  type: z.enum(["CHECKING", "SAVINGS", "CASH", "DIGITAL"]),
  code: z.string().max(20).optional().or(z.literal("")),
  bankName: z.string().max(255).optional().or(z.literal("")),
  bankBranch: z.string().max(255).optional().or(z.literal("")),
  bankAccount: z.string().max(255).optional().or(z.literal("")),
  acceptsDirectSales: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

type AccountFormValues = z.infer<typeof accountSchema>;

// FN-16: a API nunca recusa a exclusão — ela inativa quando há movimento. O
// aviso aqui é sobre o que ela quebra silenciosamente: métodos de pagamento à
// vista continuam apontando para uma conta que deixou de existir.
function getDeleteAccountMessage(account: FinancialAccount | null): React.ReactNode {
  if (!account) {
    return "";
  }

  const balance = Number(account.balance);
  if (balance !== 0) {
    return `"${account.name}" tem saldo de ${formatCurrency(balance)}. Transfira o saldo para outra conta antes de excluir.`;
  }

  const methodsCount = account._count?.paymentMethods ?? 0;
  if (methodsCount > 0) {
    return `"${account.name}" é a conta padrão de ${methodsCount} método(s) de pagamento. Troque a conta padrão desses métodos em Métodos de Pagamento antes de excluir.`;
  }

  return `Deseja excluir "${account.name}"? Se houver movimentações registradas, a conta será inativada em vez de excluída.`;
}

// ─── Page ─────────────────────────────────────────────────────────────

function FinancialAccountsPageContent() {
  const [formOpen, setFormOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FinancialAccount | null>(null);
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const deleteMutation = useDeleteFinancialAccount();

  // FT-05: a tela não oferecia nem busca. O filtro de situação importa aqui em
  // especial: o lote 4 desativou as contas duplicadas em vez de apagá-las.
  const filters = useFilters({ search: "", type: "", isActive: "" }, () => {});

  const { data, isLoading } = useFinancialAccounts({
    search: filters.values.search || undefined,
    type: (filters.values.type || undefined) as BankAccountType | undefined,
    isActive: filters.values.isActive
      ? filters.values.isActive === "true"
      : undefined,
  });

  const accounts = data?.data ?? [];

  const handleEdit = (account: FinancialAccount) => {
    setEditing(account);
    setFormOpen(true);
  };

  const handleCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    try {
      const result = await deleteMutation.mutateAsync(deleteTarget.id);
      addToast(result.data.message, "success");
      setDeleteTarget(null);
    } catch (err) {
      addToast(
        getMutationErrorMessage(err, "Erro ao excluir conta. Tente novamente."),
        "error"
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* `flex-wrap` + `items-start`: o painel de filtros pede a linha inteira
          (`basis-full`) e só consegue tomá-la se a linha puder quebrar. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">
            Contas Financeiras
          </h1>
          <p className="text-muted-foreground">
            Gerencie suas contas bancarias e caixas
          </p>
        </div>

      <FilterPanel
        values={filters.values}
        onClear={filters.clear}
        search={
          <ListSearch
            value={filters.values.search}
            onChange={(value) => filters.set("search", value)}
            placeholder="Buscar por nome ou banco..."
          />
        }
      >
        <FilterField label="Tipo">
          <Select
            value={filters.values.type || "__all"}
            onValueChange={(v) => filters.set("type", v === "__all" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos os tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os tipos</SelectItem>
              {(Object.entries(TYPE_LABELS) as [BankAccountType, string][]).map(
                ([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Situação">
          <Select
            value={filters.values.isActive || "__all"}
            onValueChange={(v) => filters.set("isActive", v === "__all" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Ativas e inativas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Ativas e inativas</SelectItem>
              <SelectItem value="true">Somente ativas</SelectItem>
              <SelectItem value="false">Somente inativas</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterPanel>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar Despesas
          </Button>
          <Button
            variant="outline"
            onClick={() => setTransferOpen(true)}
            disabled={accounts.length < 2}
          >
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Transferência
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Conta
          </Button>
        </div>
      </div>

      <ImportCsvDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        domain="expenses"
        title="Importar despesas via CSV"
        onCompleted={() =>
          queryClient.invalidateQueries({ queryKey: ["financial-entries"] })
        }
      />

      <AccountsTable
        accounts={accounts}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={setDeleteTarget}
      />

      <AccountFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
      />

      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        accounts={accounts}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {setDeleteTarget(null);}
        }}
        title="Excluir Conta"
        message={getDeleteAccountMessage(deleteTarget)}
        destructive
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────

function AccountsTable({
  accounts,
  isLoading,
  onEdit,
  onDelete,
}: {
  accounts: FinancialAccount[];
  isLoading: boolean;
  onEdit: (a: FinancialAccount) => void;
  onDelete: (a: FinancialAccount) => void;
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
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => {
                const Icon = TYPE_ICON[a.type];
                return (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <TruncatedText text={a.name} className="max-w-[36ch] font-medium" />
                        {a.code ? (
                          <span className="shrink-0 text-xs text-muted-foreground">({a.code})</span>
                        ) : null}
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
                          {a.bankBranch ? ` / Ag ${a.bankBranch}` : null}
                          {a.bankAccount ? ` / CC ${a.bankAccount}` : null}
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
                      <Badge variant={a.isActive ? "success" : "secondary"}>
                        {a.isActive ? "Ativa" : "Inativa"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {/* DS-01: sem `Tooltip` em volta, o primitivo não tem de
                          onde tirar o rótulo — este botão era um dos 14 desta
                          tela sem nome acessível nenhum. O nome inclui a conta
                          porque a tabela repete o mesmo ícone linha a linha. */}
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip content={`Editar ${a.name}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 md:h-8 md:w-8"
                            onClick={() => onEdit(a)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </Tooltip>
                        <Can permission="financial:delete" mode="disable">
                          <Tooltip content={`Excluir ${a.name}`}>
                            <Button
                              variant="ghost"
                              action="delete"
                              size="icon"
                              className="h-10 w-10 md:h-8 md:w-8"
                              onClick={() => onDelete(a)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </Tooltip>
                        </Can>
                      </div>
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
    } catch (err) {
      addToast(
        getMutationErrorMessage(
          err,
          editing
          ? "Erro ao atualizar conta. Tente novamente."
          : "Erro ao criar conta. Tente novamente."
        ),
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4"
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nome *</label>
              <Input
                {...register("name")}
                placeholder="Ex: Santander"
                maxLength={255}
              />
              {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
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
              {errors.code ? <p className="text-xs text-destructive">{errors.code.message}</p> : null}
          </div>

          {showBankFields ? <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Banco</label>
                <Input
                  {...register("bankName")}
                  placeholder="Ex: Santander"
                  maxLength={255}
                />
                  {errors.bankName ? <p className="text-xs text-destructive">{errors.bankName.message}</p> : null}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Agencia</label>
                <Input
                  {...register("bankBranch")}
                  placeholder="Ex: 1234"
                  maxLength={255}
                />
                  {errors.bankBranch ? <p className="text-xs text-destructive">{errors.bankBranch.message}</p> : null}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Conta</label>
                <Input
                  {...register("bankAccount")}
                  placeholder="Ex: 12345-6"
                  maxLength={255}
                />
                  {errors.bankAccount ? <p className="text-xs text-destructive">{errors.bankAccount.message}</p> : null}
              </div>
            </div> : null}

          <div className="flex items-center gap-6">
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
              variant="cancel"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// AE-27/FN-09: the menu hides this route, but a URL still reaches it — the
// page guard is the real one.
export default function FinancialAccountsPage() {
  return (
    <RequirePermission permission="financial:read" subject="as contas financeiras">
      <FinancialAccountsPageContent />
    </RequirePermission>
  );
}
