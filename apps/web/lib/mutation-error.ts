import { getApiErrorMessage, PERMISSION_DENIED_MESSAGE } from "@/lib/api";
import { getApiErrorStatus } from "@/lib/api-errors";

/**
 * Mensagem de erro de mutation, para o toast.
 *
 * AE-10: o backend já devolvia o motivo — "Já existe um cliente com o documento
 * 529.982.247-25", "Cannot delete category: 4 product(s) are still using it" —
 * e a UI jogava tudo fora, mostrando "Erro ao criar cliente. Tente novamente."
 * O usuário tentava de novo, dava o mesmo erro, e não tinha como descobrir o
 * porquê sem abrir o DevTools.
 *
 * A ordem importa:
 *
 * 1. **403** vira a mensagem de permissão (FN-71), porque a mensagem técnica do
 *    backend ("Permissão insuficiente para esta ação") não diz o que fazer.
 * 2. **5xx** vira o fallback: um stack trace ou "Internal server error" não
 *    ajuda ninguém, e a ação de fato precisa ser repetida.
 * 3. **O resto** usa a mensagem do backend, que é específica e acionável.
 */
export function getMutationErrorMessage(
  error: unknown,
  fallback: string
): string {
  const status = getApiErrorStatus(error);

  if (status === 403) {
    return PERMISSION_DENIED_MESSAGE;
  }
  if (status !== undefined && status >= 500) {
    return fallback;
  }

  return getApiErrorMessage(error) ?? fallback;
}
