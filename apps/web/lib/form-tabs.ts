/**
 * Erros de formulário distribuídos por abas.
 *
 * AE-11: com Nome e SKU preenchidos, "Publicar Produto" **não fazia nada**. O
 * erro estava na aba Preços, oculta: o zod recusava, o react-hook-form marcava
 * o campo, e como o campo não estava na tela ninguém via. O usuário conclui que
 * o botão está quebrado.
 *
 * A regra vale para qualquer formulário com abas: se o submit não passou, a
 * tela tem que dizer **onde** está o problema.
 */

export interface TabFieldMap {
  /** Aba → campos que moram nela. */
  [tabId: string]: readonly string[];
}

/** Quantos erros cada aba tem. Abas sem erro não aparecem no resultado. */
export function countErrorsByTab(
  errors: Record<string, unknown>,
  fieldsByTab: TabFieldMap,
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const [tabId, fields] of Object.entries(fieldsByTab)) {
    const count = fields.filter((field) => !!errors[field]).length;
    if (count > 0) {counts[tabId] = count;}
  }

  return counts;
}

/**
 * A primeira aba com erro, na ordem em que as abas aparecem na tela — é para
 * ela que o submit deve levar o usuário.
 */
export function firstTabWithError(
  errors: Record<string, unknown>,
  fieldsByTab: TabFieldMap,
  tabOrder: readonly string[],
): string | null {
  const counts = countErrorsByTab(errors, fieldsByTab);
  return tabOrder.find((tabId) => counts[tabId] > 0) ?? null;
}

/** Total de campos com erro, para a mensagem do toast. */
export function totalErrorCount(errors: Record<string, unknown>): number {
  return Object.keys(errors).length;
}

/** Mensagem do toast de submit inválido, no plural certo. */
export function invalidSubmitMessage(errorCount: number): string {
  if (errorCount <= 1) {
    return 'Existe um campo obrigatório não preenchido ou inválido.';
  }
  return `Existem ${errorCount} campos obrigatórios não preenchidos ou inválidos.`;
}
