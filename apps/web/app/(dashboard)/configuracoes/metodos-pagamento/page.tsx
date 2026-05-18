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
  usePaymentMethods,
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
  type PaymentMethod,
  type PaymentMethodType,
} from "@/hooks/use-payment-methods";
import { useToast } from "@/components/ui/toast";
import { Plus, Pencil, Loader2 } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: PaymentMethodType; label: string }[] = [
  { value: "CASH", label: "Dinheiro" },
  { value: "CREDIT_CARD", label: "Cartao de Credito" },
  { value: "DEBIT_CARD", label: "Cartao de Debito" },
  { value: "PIX", label: "PIX" },
  { value: "BOLETO", label: "Boleto" },
  { value: "BANK_TRANSFER", label: "Transferencia" },
  { value: "CHECK", label: "Cheque" },
  { value: "OTHER", label: "Outro" },
];

const TYPE_LABELS: Record<PaymentMethodType, string> = {
  CASH: "Dinheiro",
  CREDIT_CARD: "Cartao Credito",
  DEBIT_CARD: "Cartao Debito",
  PIX: "PIX",
  BOLETO: "Boleto",
  BANK_TRANSFER: "Transferencia",
  CHECK: "Cheque",
  OTHER: "Outro",
};

const TYPE_BADGE: Record<PaymentMethodType, "success" | "default" | "warning" | "secondary"> = {
  CASH: "success",
  CREDIT_CARD: "default",
  DEBIT_CARD: "default",
  PIX: "success",
  BOLETO: "warning",
  BANK_TRANSFER: "secondary",
  CHECK: "warning",
  OTHER: "secondary",
};

// ─── Schema ───────────────────────────────────────────────────────────

const methodSchema = z.object({
  name: z.string().min(1, "Nome obrigatorio").max(100),
  type: z.enum([
    "CASH",
    "CREDIT_CARD",
    "DEBIT_CARD",
    "PIX",
    "BOLETO",
    "BANK_TRANSFER",
    "CHECK",
    "OTHER",
  ]),
  feePercentage: z.number().min(0).max(100).default(0),
  settlementDays: z.number().min(0).default(0),
  requiresAuthorization: z.boolean().default(false),
  fiscalCode: z.string().max(5).optional(),
  isActive: z.boolean().default(true),
});

type MethodFormValues = z.infer<typeof methodSchema>;

// ─── Page ─────────────────────────────────────────────────────────────

export default function PaymentMethodsPage() {
  const { data, isLoading } = usePaymentMethods();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);

  const methods = data?.data ?? [];

  const handleEdit = (method: PaymentMethod) => {
    setEditing(method);
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
            Metodos de Pagamento
          </h1>
          <p className="text-muted-foreground">
            Configure os metodos de pagamento aceitos
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Metodo
        </Button>
      </div>

      <MethodsTable
        methods={methods}
        isLoading={isLoading}
        onEdit={handleEdit}
      />

      <MethodFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
      />
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────

function MethodsTable({
  methods,
  isLoading,
  onEdit,
}: {
  methods: PaymentMethod[];
  isLoading: boolean;
  onEdit: (m: PaymentMethod) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (methods.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum metodo de pagamento cadastrado
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
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Taxa %</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Liquidacao (dias)</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Autorizacao</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {methods.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant={TYPE_BADGE[m.type]}>
                      {TYPE_LABELS[m.type]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {m.feePercentage > 0 ? `${m.feePercentage}%` : "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {m.settlementDays > 0 ? `${m.settlementDays}d` : "Imediato"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {m.requiresAuthorization ? (
                      <Badge variant="warning">Sim</Badge>
                    ) : (
                      <span className="text-muted-foreground">Nao</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={m.isActive ? "success" : "secondary"}>
                      {m.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onEdit(m)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
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

// ─── Form dialog ──────────────────────────────────────────────────────

function MethodFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: PaymentMethod | null;
}) {
  const createMutation = useCreatePaymentMethod();
  const updateMutation = useUpdatePaymentMethod();
  const { addToast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<MethodFormValues>({
    resolver: zodResolver(methodSchema),
    defaultValues: {
      name: "",
      type: "CASH",
      feePercentage: 0,
      settlementDays: 0,
      requiresAuthorization: false,
      fiscalCode: "",
      isActive: true,
    },
  });

  React.useEffect(() => {
    if (open) {
      reset(
        editing
          ? {
              name: editing.name,
              type: editing.type,
              feePercentage: editing.feePercentage,
              settlementDays: editing.settlementDays,
              requiresAuthorization: editing.requiresAuthorization,
              fiscalCode: editing.fiscalCode ?? "",
              isActive: editing.isActive,
            }
          : {
              name: "",
              type: "CASH",
              feePercentage: 0,
              settlementDays: 0,
              requiresAuthorization: false,
              fiscalCode: "",
              isActive: true,
            }
      );
    }
  }, [open, editing, reset]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = async (data: MethodFormValues) => {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...data });
        addToast("Metodo atualizado com sucesso!", "success");
      } else {
        await createMutation.mutateAsync(data);
        addToast("Metodo criado com sucesso!", "success");
      }
      onOpenChange(false);
    } catch {
      addToast(
        editing
          ? "Erro ao atualizar metodo. Tente novamente."
          : "Erro ao criar metodo. Tente novamente.",
        "error"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Metodo" : "Novo Metodo"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Atualize os dados do metodo de pagamento."
              : "Preencha os dados para criar um novo metodo de pagamento."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nome *</label>
              <Input
                {...register("name")}
                placeholder="Ex: Cartao Visa"
                maxLength={100}
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

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Taxa (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.01}
                {...register("feePercentage", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Liquidacao (dias)</label>
              <Input
                type="number"
                min={0}
                {...register("settlementDays", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Cod. Fiscal</label>
              <Input
                {...register("fiscalCode")}
                placeholder="Ex: 01"
                maxLength={5}
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                {...register("requiresAuthorization")}
                className="h-4 w-4 rounded border-input"
              />
              Exige autorizacao
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                {...register("isActive")}
                className="h-4 w-4 rounded border-input"
              />
              Ativo
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
