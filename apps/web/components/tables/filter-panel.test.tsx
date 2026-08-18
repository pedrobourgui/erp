import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { FilterField, FilterPanel, countActiveFilters } from "./filter-panel";

describe("countActiveFilters", () => {
  it("ignores empty strings, null and undefined", () => {
    expect(
      countActiveFilters({ status: "", categoryId: undefined, brandId: null })
    ).toBe(0);
  });

  it("counts every applied filter", () => {
    expect(countActiveFilters({ status: "ACTIVE", categoryId: "cat-1" })).toBe(2);
  });

  it("counts a boolean only when it is true", () => {
    // "ativo/inativo" filters are booleans; `false` is a real choice but the
    // screens model "not applied" as undefined, so `false` must not inflate
    // the badge.
    expect(countActiveFilters({ isActive: false })).toBe(0);
    expect(countActiveFilters({ isActive: true })).toBe(1);
  });
});

describe("FilterPanel", () => {
  /**
   * A visibilidade é decidida por CSS, não por montagem condicional: havendo
   * espaço o painel já nasce aberto, e resolver isso em JS o faria aparecer um
   * quadro depois da tabela a cada carregamento.
   *
   * O jsdom não aplica CSS nem resolve container queries, então o que dá para
   * travar aqui é o contrato com a folha de estilo — a classe e o `data-open`.
   * Que o limiar de espaço funciona é o `e2e/filtros-layout.spec.ts` que prova,
   * medindo no navegador.
   */
  it("entrega ao CSS a decisão de aparecer, pelo data-open", async () => {
    render(
      <FilterPanel values={{}} onClear={vi.fn()}>
        <span>campo</span>
      </FilterPanel>
    );

    const panel = screen.getByTestId("filter-panel");
    expect(panel).toHaveClass("filters-panel");
    expect(panel).toHaveAttribute("data-open", "false");

    await userEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    expect(screen.getByTestId("filter-panel")).toHaveAttribute("data-open", "true");
  });

  /**
   * A classe vai no invólucro, não no `Button`: as variantes do design system
   * trazem `inline-flex`, e utility do Tailwind vence `@layer components`. Foi
   * assim que o botão continuou na tela ao lado do painel aberto.
   */
  it("deixa o CSS esconder o botão pelo invólucro, não pelo próprio botão", () => {
    const { container } = render(
      <FilterPanel values={{}} onClear={vi.fn()}>
        <span>campo</span>
      </FilterPanel>
    );

    const wrapper = container.querySelector(".filters-trigger");
    expect(wrapper).not.toBeNull();
    expect(wrapper).toContainElement(screen.getByRole("button", { name: /Filtros/ }));
    expect(screen.getByRole("button", { name: /Filtros/ })).not.toHaveClass("filters-trigger");
  });

  it("põe a busca na última célula do painel", () => {
    render(
      <FilterPanel
        values={{}}
        onClear={vi.fn()}
        search={<input aria-label="busca" />}
      >
        <span>primeiro campo</span>
      </FilterPanel>
    );

    // Buscar por nome é filtrar por nome: a busca entra no mesmo grupo, e
    // depois dos demais filtros.
    const cells = screen.getByTestId("filter-fields").children;
    expect(cells).toHaveLength(2);
    expect(cells[1]).toContainElement(screen.getByLabelText("busca"));
    expect(cells[1]).toHaveTextContent("Buscar");
  });

  it("não reserva célula de busca quando a tela não tem busca", () => {
    render(
      <FilterPanel values={{}} onClear={vi.fn()}>
        <span>campo</span>
      </FilterPanel>
    );

    expect(screen.getByTestId("filter-fields").children).toHaveLength(1);
  });

  it("dá à busca mais colunas que a um enum, por ser o campo mais usado", () => {
    render(
      <FilterPanel values={{}} onClear={vi.fn()} search={<input />}>
        <span>campo</span>
      </FilterPanel>
    );

    const cells = screen.getByTestId("filter-fields").children;
    expect(cells[1]).toHaveClass("filters-field--wide");
  });

  it("shows the number of applied filters", () => {
    render(
      <FilterPanel values={{ status: "ACTIVE", categoryId: "cat-1" }} onClear={vi.fn()}>
        <span>campo</span>
      </FilterPanel>
    );

    expect(screen.getByTestId("active-filter-count")).toHaveTextContent("2");
  });

  it("offers 'Limpar filtros' only when something is applied", async () => {
    const onClear = vi.fn();
    const { rerender } = render(
      <FilterPanel values={{ status: "" }} onClear={onClear}>
        <span>campo</span>
      </FilterPanel>
    );

    expect(screen.queryByRole("button", { name: /Limpar filtros/ })).not.toBeInTheDocument();

    rerender(
      <FilterPanel values={{ status: "ACTIVE" }} onClear={onClear}>
        <span>campo</span>
      </FilterPanel>
    );

    await userEvent.click(screen.getByRole("button", { name: /Limpar filtros/ }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  /**
   * A regressão que originou esta rodada: o painel é injetado pelo `DataTable`
   * dentro de uma linha `flex flex-wrap` e, sem `basis-full`, encolhia até o
   * tamanho do conteúdo — 609px de 1440 no desktop e 215px numa tela de 390.
   * O jsdom não calcula layout, então o que dá para travar aqui é a classe que
   * força a linha inteira. É barato e pega a remoção acidental.
   */
  it("ocupa a linha inteira em vez de encolher como flex item", async () => {
    render(
      <FilterPanel values={{}} onClear={vi.fn()}>
        <span>campo</span>
      </FilterPanel>
    );

    await userEvent.click(screen.getByRole("button", { name: /Filtros/ }));

    const panel = screen.getByTestId("filter-panel");
    expect(panel).toHaveClass("basis-full");
    expect(panel).toHaveClass("w-full");
  });
});

describe("FilterField", () => {
  it("ocupa uma coluna por padrão", () => {
    const { container } = render(<FilterField label="Status">{null}</FilterField>);
    expect(container.firstElementChild).not.toHaveClass("filters-field--wide");
  });

  it("reserva mais colunas para um campo largo", () => {
    // Cliente e Produto buscam sobre base aberta: são os campos que a divisão
    // em partes iguais sufocava.
    const { container } = render(
      <FilterField label="Cliente" span={2}>
        {null}
      </FilterField>
    );
    expect(container.firstElementChild).toHaveClass("filters-field--wide");
  });

  it("permite que o controle encolha dentro da célula", () => {
    // Sem `min-w-0` o filho mantém a largura intrínseca e o conteúdo é cortado
    // sem rolagem — o mesmo AE-07 que já mordeu as tabelas.
    const { container } = render(<FilterField label="Status">{null}</FilterField>);
    expect(container.firstElementChild).toHaveClass("min-w-0");
  });
});
