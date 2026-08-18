"use client";

import { TAX_REGIME_OPTIONS, TAX_REGIMES } from "@erp/constants";
import { isValidCNPJ } from "@erp/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import React, { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Can } from "@/components/auth/can";
import { CepInput } from "@/components/forms/cep-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useInvalidSubmit } from "@/hooks/use-invalid-submit";
import { useTenant, useUpdateTenant } from "@/hooks/use-tenant";
import { maskCNPJ, maskPhone, maskCEP } from "@/lib/masks";
import { getMutationErrorMessage } from "@/lib/mutation-error";

// ─── Schema ─────────────────────────────────────────────────────────────

const companySchema = z.object({
  name: z.string().min(3, "Razão social deve ter pelo menos 3 caracteres").max(255, "Razão social muito longa"),
  // AE-04/FN-07: counting digits accepts `11.111.111/1111-11`. The check digit
  // is the validation, and it comes from the same package the API uses.
  document: z
    .string()
    .max(18, "CNPJ muito longo")
    .refine((v) => isValidCNPJ(v), { message: "CNPJ inválido" }),
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido").max(255, "E-mail muito longo"),
  phone: z.string().max(20, "Telefone muito longo"),
  taxRegime: z.enum(TAX_REGIMES),
  addressZipCode: z.string().max(10, "CEP muito longo"),
  addressStreet: z.string().max(255, "Endereço muito longo"),
  addressNumber: z.string().max(20, "Número muito longo"),
  addressComplement: z.string().max(255, "Complemento muito longo"),
  addressNeighborhood: z.string().max(255, "Bairro muito longo"),
  addressCity: z.string().max(100, "Cidade muito longa"),
  addressState: z.string().max(2, "UF inválida"),
});

type CompanyFormValues = z.infer<typeof companySchema>;

const EMPTY_FORM: CompanyFormValues = {
  name: "",
  document: "",
  email: "",
  phone: "",
  taxRegime: "SIMPLES_NACIONAL",
  addressZipCode: "",
  addressStreet: "",
  addressNumber: "",
  addressComplement: "",
  addressNeighborhood: "",
  addressCity: "",
  addressState: "",
};

// ─── Tab ────────────────────────────────────────────────────────────────

export function CompanyTab() {
  const { data: tenant, isLoading, isError, error } = useTenant();
  const updateTenant = useUpdateTenant();
  const { addToast } = useToast();

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: EMPTY_FORM,
  });
  const { register, handleSubmit, control, reset, setValue, watch, formState } = form;
  const onInvalid = useInvalidSubmit();

  // FN-07: the form used to open with fixed empty strings and no query at all.
  useEffect(() => {
    if (!tenant) {return;}
    reset({
      name: tenant.name ?? "",
      document: maskCNPJ(tenant.document ?? ""),
      email: tenant.email ?? "",
      phone: maskPhone(tenant.phone ?? ""),
      taxRegime: tenant.taxRegime ?? "SIMPLES_NACIONAL",
      addressZipCode: maskCEP(tenant.addressZipCode ?? ""),
      addressStreet: tenant.addressStreet ?? "",
      addressNumber: tenant.addressNumber ?? "",
      addressComplement: tenant.addressComplement ?? "",
      addressNeighborhood: tenant.addressNeighborhood ?? "",
      addressCity: tenant.addressCity ?? "",
      addressState: tenant.addressState ?? "",
    });
  }, [tenant, reset]);

  const onSubmit = async (values: CompanyFormValues) => {
    try {
      await updateTenant.mutateAsync(values);
      addToast("Dados da empresa salvos com sucesso!", "success");
    } catch (err) {
      addToast(
        getMutationErrorMessage(err, "Erro ao salvar os dados da empresa."),
        "error"
      );
    }
  };

  const fieldError = (field: keyof CompanyFormValues) =>
    formState.errors[field]?.message as string | undefined;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando os dados da empresa...
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-sm text-destructive">
          {getMutationErrorMessage(error, "Não foi possível carregar os dados da empresa.")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Dados da Empresa</CardTitle>
        <CardDescription>Informações cadastrais e fiscais da empresa</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Razão Social *" error={fieldError("name")}>
              <Input {...register("name")} placeholder="Nome da empresa" maxLength={255} />
            </Field>
            <Field label="CNPJ *" error={fieldError("document")}>
              <Input
                {...register("document")}
                onChange={(e) =>
                  setValue("document", maskCNPJ(e.target.value), { shouldValidate: true })
                }
                placeholder="00.000.000/0000-00"
                maxLength={18}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="E-mail *" error={fieldError("email")}>
              <Input {...register("email")} type="email" placeholder="contato@empresa.com.br" maxLength={255} />
            </Field>
            <Field label="Telefone" error={fieldError("phone")}>
              <Input
                {...register("phone")}
                onChange={(e) =>
                  setValue("phone", maskPhone(e.target.value), { shouldValidate: true })
                }
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Controller
              name="addressZipCode"
              control={control}
              render={({ field }) => (
                <CepInput
                  id="tenant-cep"
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldError("addressZipCode")}
                  onAddressFound={(address) => {
                    setValue("addressStreet", address.street, { shouldValidate: true });
                    setValue("addressNeighborhood", address.neighborhood, { shouldValidate: true });
                    setValue("addressCity", address.city, { shouldValidate: true });
                    setValue("addressState", address.state, { shouldValidate: true });
                  }}
                />
              )}
            />
            <Field label="Endereço" error={fieldError("addressStreet")} className="sm:col-span-2">
              <Input {...register("addressStreet")} placeholder="Rua, avenida..." maxLength={255} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Número" error={fieldError("addressNumber")}>
              <Input {...register("addressNumber")} placeholder="123" maxLength={20} />
            </Field>
            <Field label="Complemento" error={fieldError("addressComplement")}>
              <Input {...register("addressComplement")} placeholder="Sala, andar..." maxLength={255} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Bairro" error={fieldError("addressNeighborhood")}>
              <Input {...register("addressNeighborhood")} placeholder="Bairro" maxLength={255} />
            </Field>
            <Field label="Cidade" error={fieldError("addressCity")}>
              <Input {...register("addressCity")} placeholder="Cidade" maxLength={100} />
            </Field>
            <Field label="UF" error={fieldError("addressState")}>
              <Input
                {...register("addressState")}
                onChange={(e) =>
                  setValue("addressState", e.target.value.toUpperCase().slice(0, 2), {
                    shouldValidate: true,
                  })
                }
                value={watch("addressState")}
                placeholder="SP"
                maxLength={2}
              />
            </Field>
          </div>

          <Field label="Regime Tributário *" error={fieldError("taxRegime")}>
            <Controller
              name="taxRegime"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="sm:max-w-xs">
                    <SelectValue placeholder="Selecione o regime" />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_REGIME_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <div className="flex justify-end pt-4">
            <Can permission="settings:update" mode="disable">
              <Button type="submit" disabled={formState.isSubmitting || updateTenant.isPending}>
                {updateTenant.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar Alterações
              </Button>
            </Can>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Field ──────────────────────────────────────────────────────────────

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <label className="text-sm font-medium">{label}</label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
