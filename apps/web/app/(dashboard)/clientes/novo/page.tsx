"use client";

import { customerSchema, type CustomerFormValues } from "@repo/validators";
import React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateCustomer } from "@/hooks/use-customers";
import { useToast } from "@/components/ui/toast";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { maskDocument, maskPhone, unmaskCNPJ, unmaskCPF, unmaskPhone } from "@/lib/masks";

// ─── Page ───────────────────────────────────────────────────────────────

export default function NewCustomerPage() {
  const router = useRouter();
  const createCustomer = useCreateCustomer();
  const { addToast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      documentType: "CPF",
      name: "",
      document: "",
      email: "",
      phone: "",
    },
  });

  const documentType = watch("documentType");

  const onSubmit = async (data: CustomerFormValues) => {
    
    try {
      const payload = {
        ...data,
        document:
        documentType === "CPF"
          ? unmaskCPF(data.document)
          : unmaskCNPJ(data.document),
        phone: unmaskPhone(data.phone),
      };

      await createCustomer.mutateAsync(payload);
      addToast("Cliente criado com sucesso!", "success");
      router.push("/clientes");
    } catch {
      addToast("Erro ao criar cliente. Tente novamente.", "error");
    }
  };

  const fieldError = (field: keyof CustomerFormValues) =>
    errors[field]?.message as string | undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Tooltip content="Voltar">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Tooltip>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Novo Cliente</h1>
          <p className="text-muted-foreground">Cadastre um novo cliente</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dados do Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DocumentTypeSelector register={register} currentType={documentType} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Nome *</label>
                <Input {...register("name")} placeholder={documentType === "CNPJ" ? "Razão Social" : "Nome completo"} maxLength={255} />
                {fieldError("name") && <p className="text-xs text-destructive">{fieldError("name")}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{documentType === "CPF" ? "CPF" : "CNPJ"} *</label>
                <Input
                  {...register("document")}
                  onChange={(e) => {
                    const masked = maskDocument(e.target.value, documentType);
                    setValue("document", masked, { shouldValidate: true });
                  }}
                  placeholder={documentType === "CPF" ? "000.000.000-00" : "00.000.000/0000-00"}
                  maxLength={documentType === "CPF" ? 14 : 18}
                />
                {fieldError("document") && <p className="text-xs text-destructive">{fieldError("document")}</p>}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">E-mail *</label>
                <Input {...register("email")} type="email" placeholder="email@exemplo.com" maxLength={255} />
                {fieldError("email") && <p className="text-xs text-destructive">{fieldError("email")}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Telefone *</label>
                <Input
                  {...register("phone")}
                  onChange={(e) => {
                    const masked = maskPhone(e.target.value);
                    setValue("phone", masked, { shouldValidate: true });
                  }}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                />
                {fieldError("phone") && <p className="text-xs text-destructive">{fieldError("phone")}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3 border-t pt-6">
          <Button type="button" variant="cancel" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting || createCustomer.isPending}>
            {createCustomer.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar Cliente
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─── Type selector ──────────────────────────────────────────────────────

function DocumentTypeSelector({
  register,
  currentType,
}: {
  register: ReturnType<typeof useForm<CustomerFormValues>>["register"];
  currentType: string;
}) {
  return (
    <div className="flex gap-2">
      {(["CPF", "CNPJ"] as const).map((type) => (
        <label
          key={type}
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
            currentType === type
              ? "border-primary bg-primary/5 text-primary"
              : "border-border text-muted-foreground hover:bg-muted/50"
          )}
        >
          <input type="radio" value={type} {...register("documentType")} className="sr-only" />
          {type === "CPF" ? "Pessoa Física" : "Pessoa Jurídica"}
        </label>
      ))}
    </div>
  );
}

