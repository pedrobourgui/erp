"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef } from "react";

import { countActiveFilters } from "@/components/tables/filter-panel";

export interface UseFiltersResult<T extends Record<string, string>> {
  /** Current values. Empty string means "not applied". */
  values: T;
  /** Sets one filter and resets the page — the two always go together. */
  set: <K extends keyof T>(key: K, value: T[K]) => void;
  clear: () => void;
  activeCount: number;
  /** Only the applied filters, ready to spread into a query. */
  queryParams: Partial<T>;
}

export interface UseFiltersOptions {
  /**
   * Chaves que mudam a cada tecla e por isso **substituem** a entrada do
   * histórico em vez de empilhar uma nova.
   *
   * Sem isso, a busca — que grava a cada 300ms — enterra o histórico: para
   * desfazer uma palavra digitada o usuário precisaria de oito "voltar", e o
   * botão deixaria de servir para desfazer o filtro anterior, que é o que ele
   * deveria fazer.
   */
  continuousKeys?: string[];
}

/**
 * Filter state that cannot forget to reset the page (FT-11), com a URL como
 * fonte da verdade.
 *
 * Every screen kept its filters in loose `useState`s and called `setPage(1)` by
 * hand inside each `onChange`. It only takes one forgotten call to leave the
 * user looking at page 7 of a result that now has two pages — an empty table
 * that reads as "no results" (the AE-28 family, from a different direction).
 *
 * O page reset é efeito colateral do `set`, então é estrutural em vez de
 * lembrado.
 *
 * **Sobre a URL**: os filtros moravam em `useState`, então um F5 perdia tudo e
 * não havia como mandar "os pedidos confirmados da Vale Verde em agosto" para
 * um colega — a única forma de descrever uma visão era descrever os cliques
 * para chegar nela. Lendo e escrevendo em `searchParams`, a visão filtrada vira
 * um endereço: sobrevive ao recarregamento, entra nos favoritos, e o "voltar"
 * do navegador desfaz o último filtro de graça.
 *
 * Não há `useState` aqui de propósito. Guardar uma cópia local ao lado da URL
 * cria duas fontes que divergem no primeiro "voltar" — o estado local não
 * saberia que a navegação aconteceu.
 */
export function useFilters<T extends Record<string, string>>(
  initial: T,
  onPageReset: () => void,
  options: UseFiltersOptions = {}
): UseFiltersResult<T> {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // `initial` é um literal no chamador: identidade nova a cada render. O que
  // interessa dele — as chaves e os padrões — não muda, então é lido uma vez.
  const defaults = useRef(initial).current;
  const continuousKeys = useRef(options.continuousKeys ?? ["search"]).current;

  const values = useMemo(() => {
    const current = { ...defaults };
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      const fromUrl = searchParams.get(String(key));
      if (fromUrl !== null) {
        current[key] = fromUrl as T[keyof T];
      }
    }
    return current;
  }, [defaults, searchParams]);

  const write = useCallback(
    (next: URLSearchParams, replace: boolean) => {
      const query = next.toString();
      const url = query ? `${pathname}?${query}` : pathname;
      // `scroll: false`: filtrar não é navegar para outra página, e jogar o
      // usuário para o topo a cada escolha faz o painel sumir da vista.
      if (replace) {
        router.replace(url, { scroll: false });
      } else {
        router.push(url, { scroll: false });
      }
      onPageReset();
    },
    [onPageReset, pathname, router]
  );

  const set = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      const next = new URLSearchParams(searchParams.toString());
      const previous = searchParams.get(String(key)) ?? "";

      // Só o que está aplicado aparece no endereço: `status=` seria uma
      // comparação exata contra "" e não devolveria nada.
      if (value) {
        next.set(String(key), value);
      } else {
        next.delete(String(key));
      }

      // Numa chave contínua, **aplicar** é um passo do histórico e **refinar**
      // não é. Substituindo desde a primeira tecla, a entrada sobrescrita seria
      // a do filtro anterior: quem escolhesse "Concluído" e depois digitasse na
      // busca perderia o "Concluído" ao voltar, porque o passo que o guardava
      // deixou de existir. Limpar também empilha — desfazer uma busca é uma
      // decisão, não um refinamento.
      const refining =
        continuousKeys.includes(String(key)) && Boolean(previous) && Boolean(value);

      write(next, refining);
    },
    [continuousKeys, searchParams, write]
  );

  const clear = useCallback(() => {
    // Apaga só as chaves deste painel: o que mais estiver no endereço não é
    // nosso para descartar.
    const next = new URLSearchParams(searchParams.toString());
    for (const key of Object.keys(defaults)) {
      next.delete(key);
    }
    write(next, false);
  }, [defaults, searchParams, write]);

  const queryParams = useMemo(() => {
    const applied: Partial<T> = {};
    for (const [key, value] of Object.entries(values)) {
      if (value) {applied[key as keyof T] = value as T[keyof T];}
    }
    return applied;
  }, [values]);

  return {
    values,
    set,
    clear,
    activeCount: countActiveFilters(values),
    queryParams,
  };
}
