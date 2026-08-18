"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import React from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { CepInput } from "@/components/forms/cep-input";
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
import { useInvalidSubmit } from "@/hooks/use-invalid-submit";
import {
  useCreateWarehouse,
  useUpdateWarehouse,
  type Warehouse,
} from "@/hooks/use-inventory";
import { maskCEP } from "@/lib/masks";
import { getMutationErrorMessage } from "@/lib/mutation-error";

const warehouseSchema = z.object({
  name: z.string().min(2, "Nome do depósito é obrigatório").max(255, "Nome muito longo"),
  zipCode: z
    .string()
    .min(1, "CEP é obrigatório")
    .max(10, "CEP muito longo")
    .refine((val) => val.replace(/\D/g, "").length === 8, { message: "CEP inválido" }),
  address: z
    .string()
    .min(5, "Endereço é obrigatório (mínimo 5 caracteres)")
    .max(500, "Endereço muito longo"),
  city: z.string().min(2, "Cidade é obrigatória").max(100, "Cidade muito longa"),
  state: z.string().length(2, "Informe a UF com 2 letras"),
  isDefault: z.boolean(),
});

type WarehouseFormValues = z.infer<typeof warehouseSchema>;

interface WarehouseFormDialogProps {
  warehouse: Warehouse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * AE-12d: the warehouse cards had no edit at all — a typo in the name or the
 * wrong CEP could only be worked around by creating another warehouse.
 *
 * AE-16: the CEP field was already here and looked nothing up; it now fills the
 * address like the customer and company forms.
 */
export function WarehouseFormDialog({
  warehouse,
  open,
  onOpenChange,
}: WarehouseFormDialogProps) {
  const { addToast } = useToast();
  const createWarehouse = useCreateWarehouse();
  const updateWarehouse = useUpdateWarehouse();
  const isEdit = !!warehouse?.id;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: {
      name: warehouse?.name ?? "",
      zipCode: maskCEP(warehouse?.zipCode ?? ""),
      address: warehouse?.address ?? "",
      city: warehouse?.city ?? "",
      state: warehouse?.state ?? "",
      isDefault: warehouse?.isDefault ?? false,
    },
  });
  const onInvalid = useInvalidSubmit();

  const isSaving = createWarehouse.isPending || updateWarehouse.isPending;

  const onSubmit = async (values: WarehouseFormValues) => {
    try {
      if (isEdit && warehouse?.id) {
        await updateWarehouse.mutateAsync({ id: warehouse.id, ...values });
        addToast("Depósito atualizado com sucesso!", "success");
      } else {
        await createWarehouse.mutateAsync(values);
        addToast("Depósito criado com sucesso!", "success");
      }
      onOpenChange(false);
    } catch (err) {
      addToast(getMutationErrorMessage(err, "Erro ao salvar o depósito."), "error");
    }
  };

  const fieldError = (field: keyof WarehouseFormValues) =>
    errors[field]?.message as string | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar depósito" : "Novo Depósito"}</DialogTitle>
          <DialogDescription>
            Digite o CEP para preencher o endereço automaticamente.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit, onInvalid)}
          className="flex min-h-0 flex-1 flex-col"
          noValidate
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <Field label="Nome *" error={fieldError("name")}>
              <Input {...register("name")} placeholder="Nome do depósito" maxLength={255} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
              <Controller
                name="zipCode"
                control={control}
                render={({ field }) => (
                  <CepInput
                    id="warehouse-cep"
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldError("zipCode")}
                    onAddressFound={(found) => {
                      setValue(
                        "address",
                        [found.street, found.neighborhood].filter(Boolean).join(", "),
                        { shouldValidate: true }
                      );
                      setValue("city", found.city, { shouldValidate: true });
                      setValue("state", found.state, { shouldValidate: true });
                    }}
                  />
                )}
              />
              <Field label="Endereço *" error={fieldError("address")}>
                <Input {...register("address")} placeholder="Rua, número" maxLength={500} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cidade *" error={fieldError("city")}>
                <Input {...register("city")} placeholder="Cidade" maxLength={100} />
              </Field>
              <Field label="UF *" error={fieldError("state")}>
                <Input
                  {...register("state")}
                  value={watch("state")}
                  onChange={(e) =>
                    setValue("state", e.target.value.toUpperCase().slice(0, 2), {
                      shouldValidate: true,
                    })
                  }
                  placeholder="SP"
                  maxLength={2}
                />
              </Field>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                {...register("isDefault")}
                disabled={warehouse?.isDefault === true}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="isDefault" className="text-sm font-medium">
                Depósito padrão
              </label>
            </div>
            {warehouse?.isDefault ? (
              <p className="text-xs text-muted-foreground">
                Para trocar o padrão, marque outro depósito como padrão.
              </p>
            ) : null}
          </div>

          <DialogFooter className="mt-4 shrink-0 border-t pt-4">
            <Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEdit ? "Salvar" : "Criar Depósito"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
