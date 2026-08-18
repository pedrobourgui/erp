"use client";

import { useCallback } from "react";
import type { FieldErrors } from "react-hook-form";

import { useToast } from "@/components/ui/toast";
import { invalidSubmitMessage, totalErrorCount } from "@/lib/form-tabs";

/**
 * Rede de segurança para submit recusado pelo zod.
 *
 * FN-13: taxa `-5`, liquidação `-10 dias`, `0` parcelas, entrada `200%` — em
 * todos esses casos clicar em "Criar" **não fazia nada**. Sem mensagem, sem
 * toast, sem requisição: as regras existiam no schema, mas os campos não
 * renderizavam `errors` e o formulário morria em silêncio.
 *
 * O erro por campo continua sendo a correção principal — este toast é o que
 * garante que nenhum submit fique mudo, mesmo se alguém esquecer um campo.
 *
 * Uso: `handleSubmit(onSubmit, onInvalid)`.
 */
export function useInvalidSubmit(
  onBeforeToast?: (errors: FieldErrors) => void
) {
  const { addToast } = useToast();

  return useCallback(
    (errors: FieldErrors) => {
      onBeforeToast?.(errors);
      addToast(
        invalidSubmitMessage(totalErrorCount(errors as Record<string, unknown>)),
        "error"
      );
    },
    [addToast, onBeforeToast]
  );
}
