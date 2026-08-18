"use client";

import { SlidersHorizontal, X } from "lucide-react";
import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

export interface FilterPanelProps {
  /** Current filter values — anything falsy counts as "not applied". */
  values: Record<string, unknown>;
  /** Clears every filter. The caller owns the state. */
  onClear: () => void;
  children: React.ReactNode;
  /**
   * A busca da tela. Entra sempre como **última célula** do painel, junto dos
   * demais filtros — buscar por nome é filtrar por nome, e mantê-la numa barra
   * separada dava a impressão de que ela não entrava na mesma conta.
   *
   * A posição mora aqui, e não em cada chamador, para não repetir a divergência
   * que o `columns` já produziu entre as telas.
   */
  search?: React.ReactNode;
  /** Colunas da busca. Padrão 2 — ela é o campo mais usado do painel. */
  searchSpan?: FilterSpan;
}

/** How many filters are actually narrowing the list. */
export function countActiveFilters(values: Record<string, unknown>): number {
  return Object.values(values).filter((v) => {
    if (v === undefined || v === null) {return false;}
    if (typeof v === "string") {return v.length > 0;}
    if (typeof v === "boolean") {return v;}
    return true;
  }).length;
}

// ─── Campo ──────────────────────────────────────────────────────────────

/**
 * Quantas colunas do grid o campo ocupa em `lg`.
 *
 * Um filtro de enum mostra "Concluído" e um de cliente mostra "Comercial de
 * Alimentos Vale Verde Ltda". Dar a mesma largura aos dois desperdiça espaço
 * num e sufoca o outro — por isso a largura é declarada pelo campo, não
 * imposta pelo painel.
 */
export type FilterSpan = 1 | 2;

// As colunas seguem a largura do container, não a do viewport, então a regra
// mora no `globals.css` junto do resto da régua — ver `.filters-field--wide`.
const SPAN_CLASS: Record<FilterSpan, string> = {
  1: "",
  2: "filters-field--wide",
};

export interface FilterFieldProps {
  label: string;
  /** Colunas ocupadas em `lg`. 1 para enums, 2 para buscas sobre base aberta. */
  span?: FilterSpan;
  className?: string;
  testId?: string;
  children: React.ReactNode;
}

/** Um filtro dentro do painel: rótulo, controle e a largura que ele pede. */
export function FilterField({
  label,
  span = 1,
  className,
  testId,
  children,
}: FilterFieldProps) {
  return (
    <div
      className={cn("min-w-0 space-y-1", SPAN_CLASS[span], className)}
      data-testid={testId}
    >
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Painel ─────────────────────────────────────────────────────────────

/**
 * O painel de filtros, uma vez só (FT-11).
 *
 * Produtos, Pedidos, Clientes e Movimentações tinham cada um a sua cópia do
 * botão, do contador de filtros ativos e do "Limpar filtros" — quatro versões
 * que já haviam divergido na contagem de colunas e no que o contador contava.
 *
 * **Sobre a largura**: o painel é injetado pelo `DataTable` dentro de uma linha
 * `flex flex-wrap`, então ele nasce como *flex item* e encolhe até o tamanho do
 * conteúdo — 609px de 1440 em Produtos, 164px por select em Pedidos, e 215px
 * numa tela de 390. O `basis-full` é o que o joga para uma linha inteira só
 * dele; o `w-full` é o que resolve o mesmo caso quando o painel é usado fora do
 * `DataTable`, onde o pai é um bloco comum.
 *
 * **Três modos, por tamanho de tela**:
 *
 * | Largura        | Comportamento                              |
 * |----------------|--------------------------------------------|
 * | `>= xl` 1280px | painel sempre aberto, sem botão            |
 * | `sm`–`xl`      | botão que abre o painel na própria página  |
 * | `< sm` 640px   | botão que abre a folha ancorada no rodapé  |
 *
 * A partir de `xl` sobra largura para os filtros e para a tabela ao mesmo
 * tempo, e aí o botão só escondia estado que já cabia na tela: era preciso
 * abrir o painel para descobrir o que os "③" do contador queriam dizer.
 *
 * A escolha entre aberto e fechado é feita por CSS, não por `useMediaQuery`:
 * o hook só sabe a largura depois do primeiro efeito, e o painel apareceria
 * com um quadro de atraso acima da tabela a cada carregamento.
 */
export function FilterPanel({
  values,
  onClear,
  children,
  search,
  searchSpan = 2,
}: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const activeCount = countActiveFilters(values);

  // A folha e o painel nunca montam juntos: seriam dois conjuntos do mesmo
  // filtro ao mesmo tempo, com ids duplicados e busca de entidade em dobro.
  const showSheet = open && isMobile;

  const fields = (
    <div className="filters-grid" data-testid="filter-fields">
      {children}
      {search ? (
        // O `testId` é a fronteira que a FT-01 usa: texto livre no painel é
        // proibido porque um campo assim virava `categoryId` na query. A busca
        // é a única exceção legítima — ela vai como `search` e é texto por
        // definição. Marcá-la nominalmente mantém a barreira de pé para
        // qualquer outro `<input>` que apareça aqui.
        <FilterField label="Buscar" span={searchSpan} testId="filter-search">
          {search}
        </FilterField>
      ) : null}
    </div>
  );

  return (
    <>
      <div className="flex items-center gap-2">
        {/*
          O invólucro existe para o CSS ter onde mandar: o `Button` já traz um
          `inline-flex` das suas variantes, e uma utility do Tailwind vence
          qualquer regra de `@layer components`. Escondê-lo pelo pai é mais
          honesto do que disputar especificidade com o design system.
        */}
        <span className="filters-trigger">
        <Button
          variant={open ? "secondary" : "outline"}
          size="sm"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Filtros
          {activeCount > 0 ? (
            <span
              className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground"
              data-testid="active-filter-count"
            >
              {activeCount}
            </span>
          ) : null}
        </Button>
        </span>

        {activeCount > 0 ? (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="mr-1 h-3 w-3" />
            Limpar filtros
          </Button>
        ) : null}
      </div>

      {/*
        Renderizado sempre que a folha não estiver no ar, e escondido por CSS —
        é o que permite "sempre aberto em `xl`" sem o quadro de atraso do
        `useMediaQuery`, mantendo uma única instância dos campos montada.
      */}
      {showSheet ? null : (
        <div
          className="filters-panel w-full basis-full rounded-lg border bg-card p-4"
          // A visibilidade é do CSS: `data-open` cobre o painel aberto pelo
          // botão, e a container query cobre o "tem espaço, fica na tela".
          data-open={open}
          data-testid="filter-panel"
        >
          {fields}
        </div>
      )}

      {/*
        Abaixo de `sm` o painel empilhado empurra a tabela para fora da tela:
        cinco filtros em coluna única são ~340px de rolagem antes da primeira
        linha do resultado. A folha ancorada embaixo mantém a tabela no lugar e
        deixa os controles ao alcance do polegar.
      */}
      <Dialog open={showSheet} onOpenChange={setOpen}>
        <DialogContent
          position="bottom"
          className="max-h-[80vh] grid-rows-[auto_1fr_auto] gap-0 p-0"
          data-testid="filter-sheet"
        >
          <DialogHeader className="border-b px-4 py-3 text-left">
            <DialogTitle className="text-base">Filtros</DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto px-4 py-4">{fields}</div>

          <div className="flex items-center gap-2 border-t px-4 py-3">
            {activeCount > 0 ? (
              <Button variant="outline" size="sm" onClick={onClear}>
                Limpar
              </Button>
            ) : null}
            <Button
              size="sm"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              Ver resultados
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
