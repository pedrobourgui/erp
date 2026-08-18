import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { useMediaQuery } from "./use-media-query";

type Listener = (event: MediaQueryListEvent) => void;

/** Instala um `matchMedia` controlável — o jsdom não traz nenhum. */
function stubMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  const list = {
    matches: initial,
    addEventListener: (_: string, fn: Listener) => listeners.add(fn),
    removeEventListener: (_: string, fn: Listener) => listeners.delete(fn),
  };
  window.matchMedia = vi.fn(() => list) as unknown as typeof window.matchMedia;
  return {
    emit(matches: boolean) {
      list.matches = matches;
      listeners.forEach((fn) => fn({ matches } as MediaQueryListEvent));
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

afterEach(() => {
  // @ts-expect-error — devolve o ambiente ao estado sem matchMedia
  delete window.matchMedia;
});

describe("useMediaQuery", () => {
  it("assume o valor real da query depois de montar", () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery("(max-width: 639px)"));
    expect(result.current).toBe(true);
  });

  it("reage à mudança de viewport", () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery("(max-width: 639px)"));
    expect(result.current).toBe(false);

    act(() => media.emit(true));
    expect(result.current).toBe(true);
  });

  it("remove o listener ao desmontar", () => {
    const media = stubMatchMedia(false);
    const { unmount } = renderHook(() => useMediaQuery("(max-width: 639px)"));
    expect(media.listenerCount).toBe(1);

    unmount();
    expect(media.listenerCount).toBe(0);
  });

  it("não quebra num ambiente sem matchMedia", () => {
    // O jsdom não implementa a API. Sem a guarda, todo teste de componente que
    // montasse um filtro falharia por um detalhe do ambiente.
    expect(window.matchMedia).toBeUndefined();
    const { result } = renderHook(() => useMediaQuery("(max-width: 639px)"));
    expect(result.current).toBe(false);
  });
});
