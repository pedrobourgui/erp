"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";

import { CustomerForm } from "@/components/forms/customer-form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { useCreateCustomer, type CustomerFormData } from "@/hooks/use-customers";
import { getMutationErrorMessage } from "@/lib/mutation-error";

export default function NewCustomerPage() {
  const router = useRouter();
  const createCustomer = useCreateCustomer();
  const { addToast } = useToast();

  const handleSubmit = async (values: CustomerFormData) => {
    try {
      await createCustomer.mutateAsync(values);
      addToast("Cliente criado com sucesso!", "success");
      router.push("/clientes");
    } catch (err) {
      addToast(
        getMutationErrorMessage(err, "Erro ao criar cliente. Tente novamente."),
        "error"
      );
    }
  };

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

      <CustomerForm
        mode="create"
        isSaving={createCustomer.isPending}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
    </div>
  );
}
