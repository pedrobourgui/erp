/**
 * Levar o usuário até o erro que recusou o submit.
 *
 * FN-13 tratou o submit mudo com um toast, e AE-11 tratou o erro escondido em
 * outra aba. Falta o terceiro caso: o campo está na tela, renderiza seu erro,
 * e mesmo assim o usuário não vê nada — porque o botão de submit fica em um
 * painel fixo e o campo com erro rolou para fora da área visível.
 *
 * Foi exatamente o que aconteceu na Venda no Balcão: com o carrinho cheio, o
 * "Selecione um cliente" ficava acima do topo do `<main>` (que tem scroll
 * próprio) enquanto "Finalizar Venda" continuava visível no painel lateral. O
 * clique não fazia nada aos olhos de quem estava no balcão.
 */

/** Onde os erros de campo aparecem — ver `text-destructive` nos componentes de formulário. */
const ERROR_SELECTOR = "[aria-invalid='true'], .text-destructive";

/**
 * O primeiro erro **renderizado** dentro do container, na ordem do documento.
 * Ignora nós fora da árvore e containers vazios.
 */
export function firstErrorElement(
  container: HTMLElement | null | undefined
): HTMLElement | null {
  if (!container) {return null;}
  return container.querySelector<HTMLElement>(ERROR_SELECTOR);
}

/**
 * Rola até o primeiro erro do formulário. Devolve `true` quando encontrou algo
 * para mostrar — o chamador não precisa saber se havia erro renderizado.
 */
export function scrollToFirstError(
  container: HTMLElement | null | undefined
): boolean {
  const target = firstErrorElement(container);
  if (!target) {return false;}

  target.scrollIntoView({ behavior: "smooth", block: "center" });

  // O elemento do erro costuma ser o `<p>` da mensagem, que não recebe foco.
  // Focar o controle mais próximo deixa o usuário digitar a correção direto.
  const focusable = target.matches("input, select, textarea, button")
    ? target
    : target.parentElement?.querySelector<HTMLElement>(
        "input, select, textarea, button"
      );
  focusable?.focus({ preventScroll: true });

  return true;
}

/**
 * O mesmo, agendado para **depois** da renderização.
 *
 * `onInvalid` roda no mesmo tick em que o react-hook-form marca os erros: as
 * mensagens ainda não existem no DOM, então procurar por elas nessa hora não
 * encontra nada e a tela não rola. Dois frames garantem o commit do React
 * antes da busca.
 */
export function scheduleScrollToFirstError(
  getContainer: () => HTMLElement | null | undefined
): void {
  const run = () => scrollToFirstError(getContainer());

  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => requestAnimationFrame(run));
    return;
  }
  setTimeout(run, 0);
}
