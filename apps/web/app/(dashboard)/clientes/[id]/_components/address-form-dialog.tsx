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
import {
  useCreateCustomerAddress,
  useUpdateCustomerAddress,
  type CustomerAddress,
} from "@/hooks/use-customers";
import { useInvalidSubmit } from "@/hooks/use-invalid-submit";
import { maskCEP } from "@/lib/masks";
import { getMutationErrorMessage } from "@/lib/mutation-error";

const LABEL_OPTIONS = ["Entrega", "Cobrança", "Casa", "Trabalho", "Outro"];

const schema = z.object({
  label: z.string().max(50, "Identificação muito longa"),
  zipCode: z
    .string()
    .refine((v) => v.replace(/\D/g, "").length === 8, { message: "CEP inválido" }),
  street: z.string().min(1, "Logradouro é obrigatório").max(255, "Logradouro muito longo"),
  number: z.string().min(1, "Número é obrigatório").max(20, "Número muito longo"),
  complement: z.string().max(255, "Complemento muito longo"),
  neighborhood: z.string().min(1, "Bairro é obrigatório").max(255, "Bairro muito longo"),
  city: z.string().min(1, "Cidade é obrigatória").max(100, "Cidade muito longa"),
  state: z.string().length(2, "UF deve ter 2 letras"),
  isDefault: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface AddressFormDialogProps {
  customerId: string;
  address: CustomerAddress | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * AE-16: the customer detail page has always had an "Endereços" tab that could
 * never be filled — the create form has four fields and no address endpoint
 * existed.
 */
export function AddressFormDialog({
  customerId,
  address,
  open,
  onOpenChange,
}: AddressFormDialogProps) {
  const { addToast } = useToast();
  const createAddress = useCreateCustomerAddress(customerId);
  const updateAddress = useUpdateCustomerAddress(customerId);
  const isEdit = !!address?.id;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      label: address?.label ?? "Entrega",
      zipCode: maskCEP(address?.zipCode ?? ""),
      street: address?.street ?? "",
      number: address?.number ?? "",
      complement: address?.complement ?? "",
      neighborhood: address?.neighborhood ?? "",
      city: address?.city ?? "",
      state: address?.state ?? "",
      isDefault: address?.isDefault ?? false,
    },
  });
  const onInvalid = useInvalidSubmit();

  const isSaving = createAddress.isPending || updateAddress.isPending;

  const onSubmit = async (values: FormValues) => {
    const payload = {
      label: values.label || undefined,
      zipCode: values.zipCode,
      street: values.street,
      number: values.number,
      complement: values.complement || undefined,
      neighborhood: values.neighborhood,
      city: values.city,
      state: values.state,
      isDefault: values.isDefault,
    };

    try {
      if (isEdit && address?.id) {
        await updateAddress.mutateAsync({ addressId: address.id, ...payload });
        addToast("Endereço atualizado com sucesso!", "success");
      } else {
        await createAddress.mutateAsync(payload);
        addToast("Endereço adicionado com sucesso!", "success");
      }
      onOpenChange(false);
    } catch (err) {
      addToast(getMutationErrorMessage(err, "Erro ao salvar o endereço."), "error");
    }
  };

  const fieldError = (field: keyof FormValues) =>
    errors[field]?.message as string | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar endereço" : "Novo endereço"}</DialogTitle>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Identificação</label>
                <Select
                  value={watch("label")}
                  onValueChange={(v) => setValue("label", v, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Entrega" />
                  </SelectTrigger>
                  <SelectContent>
                    {LABEL_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldError("label") ? (
                  <p className="text-xs text-destructive">{fieldError("label")}</p>
                ) : null}
              </div>

              <Controller
                name="zipCode"
                control={control}
                render={({ field }) => (
                  <CepInput
                    id="address-cep"
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldError("zipCode")}
                    onAddressFound={(found) => {
                      setValue("street", found.street, { shouldValidate: true });
                      setValue("neighborhood", found.neighborhood, { shouldValidate: true });
                      setValue("city", found.city, { shouldValidate: true });
                      setValue("state", found.state, { shouldValidate: true });
                    }}
                  />
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
              <Field label="Logradouro *" error={fieldError("street")}>
                <Input {...register("street")} placeholder="Rua, avenida..." maxLength={255} />
              </Field>
              <Field label="Número *" error={fieldError("number")}>
                <Input {...register("number")} placeholder="123" maxLength={20} />
              </Field>
            </div>

            <Field label="Complemento" error={fieldError("complement")}>
              <Input {...register("complement")} placeholder="Apto, bloco..." maxLength={255} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Bairro *" error={fieldError("neighborhood")}>
                <Input {...register("neighborhood")} maxLength={255} />
              </Field>
              <Field label="Cidade *" error={fieldError("city")}>
                <Input {...register("city")} maxLength={100} />
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

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("isDefault")} className="h-4 w-4" />
              Definir como endereço principal
            </label>
          </div>

          <div className="mt-4 flex shrink-0 justify-end gap-2 border-t pt-4">
            <Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEdit ? "Salvar" : "Adicionar"}
            </Button>
          </div>
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
