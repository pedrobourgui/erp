import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Cabeçalho das telas de lista.
 *
 * T1: as listas empilhavam cinco faixas horizontais antes do primeiro dado —
 * breadcrumb (30px), título com subtítulo (74px), um botão "Filtros" sozinho
 * numa linha (54px), a linha de busca com "Exportar CSV" (66px) e o cabeçalho
 * da tabela (48px). A primeira linha de registro começava em y=378px de uma
 * área útil de 836px: **45% da tela era cromo**, e ler uma página de 20
 * resultados exigia rolar duas vezes.
 *
 * Aqui as faixas viram duas: título com as ações à direita, e uma linha de
 * controles onde a busca e os filtros convivem. Junto com a linha de tabela de
 * 44px, a mesma tela passa a mostrar 14 registros em vez de 9.
 *
 * O subtítulo saiu de propósito: "Gerencie seu catálogo de produtos" sob um
 * título "Produtos" não informa nada que o título já não diga. Continua
 * disponível via `description` para as telas em que ele realmente explica algo.
 */
export interface ListPageHeaderProps {
  title: string;
  /** Só quando explica algo que o título não diz. */
  description?: string;
  /** Ações da tela — "Novo", "Importar". Alinhadas à direita em `sm`+. */
  actions?: React.ReactNode;
  /** Busca, selects de filtro, exportação: a segunda faixa. */
  controls?: React.ReactNode;
  className?: string;
}

export function ListPageHeader({
  title,
  description,
  actions,
  controls,
  className,
}: ListPageHeaderProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>

      {controls ? (
        <div className="flex flex-wrap items-center gap-2">{controls}</div>
      ) : null}
    </div>
  );
}
