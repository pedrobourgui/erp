import { act, renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useFilters } from "./use-filters";

const PATH = "/estoque/produtos";

/**
 * Um `next/navigation` de mentira que se comporta como o de verdade no que
 * importa aqui: navegar troca os `searchParams` que o próximo render lê.
 *
 * Sem isso o teste provaria só que `router.push` foi chamado — e o hook usa a
 * URL como fonte da verdade, então o que precisa ser verificado é o caminho
 * completo: escrever no endereço e ler de volta dele.
 */
const nav = {
  params: new URLSearchParams(),
  push: vi.fn(),
  replace: vi.fn(),
};

function goTo(url: string) {
  nav.params = new URLSearchParams(url.split("?")[1] ?? "");
}

vi.mock("next/navigation", () => ({
  usePathname: () => PATH,
  useRouter: () => ({
    push: (url: string) => {
      nav.push(url);
      goTo(url);
    },
    replace: (url: string) => {
      nav.replace(url);
      goTo(url);
    },
  }),
  useSearchParams: () => nav.params,
}));

const INITIAL = { status: "", categoryId: "", brandId: "" };

beforeEach(() => {
  nav.params = new URLSearchParams();
  nav.push.mockClear();
  nav.replace.mockClear();
});

describe("useFilters", () => {
  it("starts with every filter unapplied", () => {
    const { result } = renderHook(() => useFilters(INITIAL, vi.fn()));

    expect(result.current.values).toEqual(INITIAL);
    expect(result.current.activeCount).toBe(0);
    expect(result.current.queryParams).toEqual({});
  });

  it("resets the page whenever a filter changes", () => {
    // FT-11: every screen called `setPage(1)` by hand inside each onChange, and
    // one forgotten call left the user on page 7 of a two-page result — an
    // empty table that reads as "no results".
    const onPageReset = vi.fn();
    const { result, rerender } = renderHook(() =>
      useFilters(INITIAL, onPageReset)
    );

    act(() => result.current.set("status", "ACTIVE"));
    rerender();

    expect(result.current.values.status).toBe("ACTIVE");
    expect(onPageReset).toHaveBeenCalledTimes(1);
  });

  it("resets the page when the filters are cleared", () => {
    const onPageReset = vi.fn();
    const { result, rerender } = renderHook(() =>
      useFilters(INITIAL, onPageReset)
    );

    act(() => result.current.set("status", "ACTIVE"));
    rerender();
    act(() => result.current.clear());
    rerender();

    expect(result.current.values).toEqual(INITIAL);
    expect(onPageReset).toHaveBeenCalledTimes(2);
  });

  it("exposes only the applied filters as query params", () => {
    const { result, rerender } = renderHook(() => useFilters(INITIAL, vi.fn()));

    act(() => result.current.set("categoryId", "cat-1"));
    rerender();

    // An empty string must not reach the query: `categoryId=` would be an
    // exact match against "" and return nothing.
    expect(result.current.queryParams).toEqual({ categoryId: "cat-1" });
  });

  it("counts the applied filters", () => {
    const { result, rerender } = renderHook(() => useFilters(INITIAL, vi.fn()));

    act(() => result.current.set("status", "ACTIVE"));
    rerender();
    act(() => result.current.set("brandId", "brand-1"));
    rerender();

    expect(result.current.activeCount).toBe(2);
  });

  it("drops a filter back to unapplied when set to empty", () => {
    const { result, rerender } = renderHook(() => useFilters(INITIAL, vi.fn()));

    act(() => result.current.set("status", "ACTIVE"));
    rerender();
    act(() => result.current.set("status", ""));
    rerender();

    expect(result.current.activeCount).toBe(0);
    expect(result.current.queryParams).toEqual({});
  });
});

/**
 * A visão filtrada como endereço.
 *
 * Os filtros moravam em `useState`: um F5 perdia tudo, e a única forma de
 * passar "os pedidos confirmados da Vale Verde" para um colega era descrever os
 * cliques para chegar lá.
 */
describe("useFilters e a URL", () => {
  it("lê os filtros do endereço ao montar", () => {
    goTo(`${PATH}?status=ACTIVE&categoryId=cat-7`);

    const { result } = renderHook(() => useFilters(INITIAL, vi.fn()));

    expect(result.current.values.status).toBe("ACTIVE");
    expect(result.current.values.categoryId).toBe("cat-7");
    expect(result.current.activeCount).toBe(2);
  });

  it("escreve o filtro aplicado no endereço", () => {
    const { result } = renderHook(() => useFilters(INITIAL, vi.fn()));

    act(() => result.current.set("status", "ACTIVE"));

    expect(nav.push).toHaveBeenCalledWith(`${PATH}?status=ACTIVE`);
  });

  it("tira do endereço o filtro que voltou a não estar aplicado", () => {
    goTo(`${PATH}?status=ACTIVE`);
    const { result } = renderHook(() => useFilters(INITIAL, vi.fn()));

    act(() => result.current.set("status", ""));

    // E não `?status=`, que a API leria como igualdade exata contra "".
    expect(nav.push).toHaveBeenCalledWith(PATH);
  });

  it("empilha uma entrada de histórico por filtro escolhido", () => {
    // É o que faz o "voltar" do navegador desfazer o último filtro.
    const { result } = renderHook(() => useFilters(INITIAL, vi.fn()));

    act(() => result.current.set("status", "ACTIVE"));

    expect(nav.push).toHaveBeenCalledTimes(1);
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("empilha a primeira busca, para o passo anterior sobreviver", () => {
    // Se a primeira tecla substituísse, a entrada sobrescrita seria a do filtro
    // anterior: quem escolhe "Concluído" e depois digita perderia o "Concluído"
    // ao voltar.
    goTo(`${PATH}?status=ACTIVE`);
    const { result } = renderHook(() =>
      useFilters({ search: "", status: "" }, vi.fn())
    );

    act(() => result.current.set("search", "cad"));

    expect(nav.push).toHaveBeenCalledWith(`${PATH}?status=ACTIVE&search=cad`);
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("substitui enquanto a busca é refinada", () => {
    // A busca grava a cada 300ms. Empilhando cada uma, desfazer uma palavra
    // digitada custaria oito "voltar".
    goTo(`${PATH}?search=cad`);
    const { result } = renderHook(() =>
      useFilters({ search: "", status: "" }, vi.fn())
    );

    act(() => result.current.set("search", "cade"));

    expect(nav.replace).toHaveBeenCalledTimes(1);
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("empilha ao limpar a busca — desfazer é uma decisão", () => {
    goTo(`${PATH}?search=cadeira`);
    const { result } = renderHook(() =>
      useFilters({ search: "", status: "" }, vi.fn())
    );

    act(() => result.current.set("search", ""));

    expect(nav.push).toHaveBeenCalledWith(PATH);
  });

  it("preserva no endereço o que não é filtro deste painel", () => {
    goTo(`${PATH}?status=ACTIVE&aba=historico`);
    const { result } = renderHook(() => useFilters(INITIAL, vi.fn()));

    act(() => result.current.clear());

    // `clear` apaga os filtros, não o endereço inteiro.
    expect(nav.push).toHaveBeenCalledWith(`${PATH}?aba=historico`);
  });

  it("ignora parâmetros do endereço que não são filtros conhecidos", () => {
    goTo(`${PATH}?status=ACTIVE&sqlInjection=1`);

    const { result } = renderHook(() => useFilters(INITIAL, vi.fn()));

    expect(result.current.values).toEqual({
      status: "ACTIVE",
      categoryId: "",
      brandId: "",
    });
    expect(result.current.queryParams).toEqual({ status: "ACTIVE" });
  });
});
