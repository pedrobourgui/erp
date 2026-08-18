"use client";

import { useEffect, useState } from "react";

/**
 * Acompanha uma media query no cliente.
 *
 * Começa sempre em `false` e só passa a valer depois do primeiro efeito: no
 * servidor não existe viewport, e chutar um valor na renderização inicial é o
 * que produz o descasamento de hidratação. Quem consome isto deve tratar
 * `false` como "ainda não sei", não como "é desktop" — na prática o painel de
 * filtros só monta depois de um clique, quando o valor já é real.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // O jsdom não implementa `matchMedia`. Sem esta guarda todo teste de
    // componente que monte um filtro quebraria por um detalhe do ambiente.
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const list = window.matchMedia(query);
    setMatches(list.matches);

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Abaixo do breakpoint `sm` do Tailwind (640px). */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 639px)");
}
