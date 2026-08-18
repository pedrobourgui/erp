"use client";

import { documentErrorMessage, isValidDocument } from "@erp/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CustomerFormData } from "@/hooks/use-customers";
import { useInvalidSubmit } from "@/hooks/use-invalid-submit";
import { maskDocument, maskPhone } from "@/lib/masks";
import { cn } from "@/lib/utils";

// ─── Schema ─────────────────────────────────────────────────────────────

const customerSchema = z.object({
  documentType: z.enum(["CPF", "CNPJ"]),
  name: z
    .string()
    .min(3, "Nome deve ter pelo menos 3 caracteres")
    .max(255, "Nome muito longo"),
  // AE-04: counting digits accepted `111.111.111-11`. The real validation is
  // the check digit, and it comes from @erp/validators — the same one the API
  // uses.
  document: z.string().max(18, "Documento muito longo"),
  email: z
    .string()
    .min(1, "E-mail é obrigatório")
    .email("E-mail inválido")
    .max(255, "E-mail muito longo"),
  phone: z
    .string()
    .min(1, "Telefone é obrigatório")
    .max(20, "Telefone muito longo")
    .refine(
      (val) => {
        const digits = val.replace(/\D/g, "");
        return digits.length >= 10 && digits.length <= 11;
      },
      { message: "Telefone inválido" }
    ),
});

const customerSchemaWithDocument = customerSchema.superRefine((data, ctx) => {
  if (!isValidDocument(data.document, data.documentType)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["document"],
      message: documentErrorMessage(data.documentType),
    });
  }
});

export type CustomerFormValues = z.infer<typeof customerSchema>;

// ─── Component ──────────────────────────────────────────────────────────

interface CustomerFormProps {
  mode: "create" | "edit";
  defaultValues?: Partial<CustomerFormValues>;
  isSaving?: boolean;
  onSubmit: (values: CustomerFormData) => Promise<void>;
  onCancel: () => void;
}

/**
 * AE-06: the customer CRUD had no "U".
 *
 * The detail page imported the `Edit` icon and never used it, `/clientes/[id]/edit`
 * was a 404, and `PATCH /customers/:id` had been there the whole time. This is
 * the create form extracted so both routes share one schema — a second copy is
 * how the edit path became a second open door for invalid documents (AE-08).
 */
export function CustomerForm({
  mode,
  defaultValues,
  isSaving,
  onSubmit,
  onCancel,
}: CustomerFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchemaWithDocument),
    defaultValues: {
      documentType: "CPF",
      name: "",
      document: "",
      email: "",
      phone: "",
      ...defaultValues,
    },
  });
  const onInvalid = useInvalidSubmit();

  const documentType = watch("documentType");

  const fieldError = (field: keyof CustomerFormValues) =>
    errors[field]?.message as string | undefined;

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit(values), onInvalid)}
      className="space-y-6"
      noValidate
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados do Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {(["CPF", "CNPJ"] as const).map((type) => (
              <label
                key={type}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                  documentType === type
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/50"
                )}
              >
                <input
                  type="radio"
                  value={type}
                  {...register("documentType")}
                  className="sr-only"
                />
                {type === "CPF" ? "Pessoa Física" : "Pessoa Jurídica"}
              </label>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nome *</label>
              <Input
                {...register("name")}
                placeholder={documentType === "CNPJ" ? "Razão Social" : "Nome completo"}
                maxLength={255}
              />
              {fieldError("name") ? (
                <p className="text-xs text-destructive">{fieldError("name")}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">
                {documentType === "CPF" ? "CPF" : "CNPJ"} *
              </label>
              <Input
                {...register("document")}
                onChange={(e) =>
                  setValue("document", maskDocument(e.target.value, documentType), {
                    shouldValidate: true,
                  })
                }
                placeholder={
                  documentType === "CPF" ? "000.000.000-00" : "00.000.000/0000-00"
                }
                maxLength={documentType === "CPF" ? 14 : 18}
              />
              {fieldError("document") ? (
                <p className="text-xs text-destructive">{fieldError("document")}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">E-mail *</label>
              <Input
                {...register("email")}
                type="email"
                placeholder="email@exemplo.com"
                maxLength={255}
              />
              {fieldError("email") ? (
                <p className="text-xs text-destructive">{fieldError("email")}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Telefone *</label>
              <Input
                {...register("phone")}
                onChange={(e) =>
                  setValue("phone", maskPhone(e.target.value), { shouldValidate: true })
                }
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
              {fieldError("phone") ? (
                <p className="text-xs text-destructive">{fieldError("phone")}</p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3 border-t pt-6">
        <Button type="button" variant="cancel" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting || isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {mode === "create" ? "Salvar Cliente" : "Salvar Alterações"}
        </Button>
      </div>
    </form>
  );
}
