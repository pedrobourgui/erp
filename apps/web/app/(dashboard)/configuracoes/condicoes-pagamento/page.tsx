"use client";

import { conditionSchema, type ConditionFormValues} from "@repo/validators"
import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  usePaymentConditions,
  useCreatePaymentCondition,
  useUpdatePaymentCondition,
  useDeletePaymentCondition,
  type PaymentCondition,
  type PaymentConditionType,
} from "@/hooks/use-payment-conditions";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, cn } from "@/lib/utils";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

// ─── Constants ─────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: PaymentConditionType; label: string }[] = [
  { value: "CASH", label: "A Vista" },
  { value: "INSTALLMENT", label: "Parcelado" },
  { value: "ENTRY_PLUS_INSTALLMENT", label: "Entrada + Parcelas" },
];

const TYPE_BADGE: Record<PaymentConditionType, "success" | "default" | "warning"> = {
  CASH: "success",
  INSTALLMENT: "default",
  ENTRY_PLUS_INSTALLMENT: "warning",
};

const TYPE_LABELS: Record<PaymentConditionType, string> = {
  CASH: "A Vista",
  INSTALLMENT: "Parcelado",
  ENTRY_PLUS_INSTALLMENT: "Entrada + Parcelas",
};

// ─── Page ──────────────────────────────────────────────────────────────

export default function PaymentConditionsPage() {
  const { data, isLoading } = usePaymentConditions();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentCondition | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentCondition | null>(null);

  const conditions = data?.data ?? [];

  const handleEdit = (condition: PaymentCondition) => {
    setEditing(condition);
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
            Condicoes de Pagamento
          </h1>
          <p className="text-muted-foreground">
            Configure as condicoes de pagamento disponiveis
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Condicao
        </Button>
      </div>

      <ConditionsTable
        conditions={conditions}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={setDeleteTarget}
      />

      <ConditionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
      />

      <DeleteConditionDialog
        condition={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ─── Table ─────────────────────────────────────────────────────────────

function ConditionsTable({
  conditions,
  isLoading,
  onEdit,
  onDelete,
}: {
  conditions: PaymentCondition[];
  isLoading: boolean;
  onEdit: (c: PaymentCondition) => void;
  onDelete: (c: PaymentCondition) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (conditions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhuma condicao de pagamento cadastrada
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
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Codigo</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Parcelas</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Dias</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Entrada %</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {conditions.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.code}</td>
                  <td className="px-4 py-3">
                    <Badge variant={TYPE_BADGE[c.type]}>
                      {TYPE_LABELS[c.type]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">{c.installments}</td>
                  <td className="px-4 py-3 text-center">{c.daysBetweenInstallments}</td>
                  <td className="px-4 py-3 text-center">{c.entryPercentage}%</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" action="delete" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(c)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Form dialog ───────────────────────────────────────────────────────

function ConditionFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: PaymentCondition | null;
}) {
  const createMutation = useCreatePaymentCondition();
  const updateMutation = useUpdatePaymentCondition();
  const { addToast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<ConditionFormValues>({
    resolver: zodResolver(conditionSchema),
    defaultValues: editing
      ? {
          name: editing.name,
          code: editing.code,
          type: editing.type,
          installments: editing.installments,
          daysBetweenInstallments: editing.daysBetweenInstallments,
          entryPercentage: editing.entryPercentage,
        }
      : {
          name: "",
          code: "",
          type: undefined,
          installments: 1,
          daysBetweenInstallments: 30,
          entryPercentage: 0,
        },
  });

  // Reset form when editing changes
  React.useEffect(() => {
    if (open) {
      reset(
        editing
          ? {
              name: editing.name,
              code: editing.code,
              type: editing.type,
              installments: editing.installments,
              daysBetweenInstallments: editing.daysBetweenInstallments,
              entryPercentage: editing.entryPercentage,
            }
          : {
              name: "",
              code: "",
              type: undefined,
              installments: 1,
              daysBetweenInstallments: 30,
              entryPercentage: 0,
            }
      );
    }
  }, [open, editing, reset]);

  const selectedType = watch("type");
  const installments = watch("installments");
  const daysBetween = watch("daysBetweenInstallments");
  const entryPct = watch("entryPercentage");
  const showInstallments = selectedType !== "CASH";
  const showEntry = selectedType === "ENTRY_PLUS_INSTALLMENT";
  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = async (data: ConditionFormValues) => {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...data });
        addToast("Condicao atualizada com sucesso!", "success");
      } else {
        await createMutation.mutateAsync(data);
        addToast("Condicao criada com sucesso!", "success");
      }
      onOpenChange(false);
    } catch {
      addToast(
        editing
          ? "Erro ao atualizar condicao. Tente novamente."
          : "Erro ao criar condicao. Tente novamente.",
        "error"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Condicao" : "Nova Condicao"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Atualize os dados da condicao de pagamento."
              : "Preencha os dados para criar uma nova condicao de pagamento."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nome *</label>
              <Input {...register("name")} placeholder="Ex: 3x sem juros" maxLength={100} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Codigo *</label>
              <Input {...register("code")} placeholder="Ex: 3X_SJ" maxLength={20} />
              {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Tipo *</label>
            <Controller
              name="type"
              control={control}
              render={({ field, fieldState}) => (
                <div>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.error && (
                    <p className="text-xs text-destructive pt-1">{fieldState.error.message}</p>
                  )}
                </div>
              )}
            />
          </div>

          {showInstallments && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Parcelas</label>
                <Input
                  type="number"
                  min={1}
                  max={48}
                  onInput={(e) => {
                    const value = e.currentTarget.value;

                    // Bloqueia valores muito grandes de digitação/cola
                    if (value.length > 3) {
                      e.currentTarget.value = value.slice(0, 3);
                    }
                  }}
                  {...register("installments", { valueAsNumber: true })}
                />
                {errors.installments && <p className="text-xs text-destructive">{errors.installments.message}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Dias entre parcelas</label>
                <Input
                  type="number"
                  min={1}
                  max={730}
                  onInput={(e) => {
                    const value = e.currentTarget.value;

                    // Bloqueia valores muito grandes de digitação/cola
                    if (value.length > 3) {
                      e.currentTarget.value = value.slice(0, 3);
                    }
                  }}
                
                  {...register("daysBetweenInstallments", { valueAsNumber: true })}
                />
                {errors.daysBetweenInstallments && <p className="text-xs text-destructive">{errors.daysBetweenInstallments.message}</p>}
              </div>
            </div>  
          )}

          {showEntry && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Entrada (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.01}
                onInput={(e) => {
                  const value = e.currentTarget.value;

                  // Bloqueia valores muito grandes de digitação/cola
                  if (value.length > 3) {
                    e.currentTarget.value = value.slice(0, 3);
                  }
                }}

                {...register("entryPercentage", { valueAsNumber: true })}
              />
              {errors.entryPercentage && <p className="text-xs text-destructive">{errors.entryPercentage.message}</p>}
            </div>
          )}

          {/* Preview */}
          <InstallmentPreview
            type={selectedType}
            installments={installments}
            daysBetween={daysBetween}
            entryPercentage={entryPct}  
          />

          <DialogFooter>
            <Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>
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

// ─── Preview ───────────────────────────────────────────────────────────

function InstallmentPreview({
  type,
  installments,
  daysBetween,
  entryPercentage,
}: {
  type: PaymentConditionType;
  installments: number;
  daysBetween: number;
  entryPercentage: number;
}) {
  const SAMPLE_AMOUNT = 1000;

  const lines = React.useMemo(() => {
    if (type === "CASH") {
      return [{ label: "A vista", amount: SAMPLE_AMOUNT, days: 0 }];
    }

    const result: { label: string; amount: number; days: number }[] = [];

    if (type === "ENTRY_PLUS_INSTALLMENT" && entryPercentage > 0) {
      const entryAmount = (SAMPLE_AMOUNT * entryPercentage) / 100;
      result.push({ label: "Entrada", amount: entryAmount, days: 0 });
      const remaining = SAMPLE_AMOUNT - entryAmount;
      const perInstallment = remaining / Math.max(installments, 1);
      for (let i = 1; i <= installments; i++) {
        result.push({
          label: `Parcela ${i}/${installments}`,
          amount: perInstallment,
          days: i * daysBetween,
        });
      }
    } else {
      const perInstallment = SAMPLE_AMOUNT / Math.max(installments, 1);
      for (let i = 1; i <= installments; i++) {
        result.push({
          label: `Parcela ${i}/${installments}`,
          amount: perInstallment,
          days: i * daysBetween,
        });
      }
    }

    return result;
  }, [type, installments, daysBetween, entryPercentage]);

  return (
    <div className="rounded-lg border bg-muted/30 p-3 dark:bg-muted/10">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Exemplo para {formatCurrency(SAMPLE_AMOUNT)}
      </p>
      <div className="space-y-1">
        {lines.map((line, idx) => (
          <div key={idx} className="flex items-center justify-between text-sm">
            <span>{line.label}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {line.days === 0 ? "Hoje" : `${line.days} dias`}
              </span>
              <span className="font-medium">{formatCurrency(line.amount)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Delete dialog ─────────────────────────────────────────────────────

function DeleteConditionDialog({
  condition,
  onClose,
}: {
  condition: PaymentCondition | null;
  onClose: () => void;
}) {
  const deleteMutation = useDeletePaymentCondition();
  const { addToast } = useToast();

  const handleDelete = async () => {
    if (!condition) return;
    try {
      await deleteMutation.mutateAsync(condition.id);
      addToast("Condicao excluida com sucesso!", "success");
      onClose();
    } catch {
      addToast("Erro ao excluir condicao. Tente novamente.", "error");
      onClose();
    }
  };

  return (
    <ConfirmDialog
      open={!!condition}
      onOpenChange={(open) => !open && onClose()}
      title="Excluir Condicao"
      message={`Deseja excluir a condicao "${condition?.name}"? Esta acao nao pode ser desfeita.`}
      destructive
      loading={deleteMutation.isPending}
      onConfirm={handleDelete}
    />
  );
}
