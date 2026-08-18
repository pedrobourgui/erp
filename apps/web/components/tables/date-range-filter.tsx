"use client";

import React from "react";

import { FilterField } from "@/components/tables/filter-panel";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface DateRangeFilterProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  /** FN-23: fim anterior ao início. O chamador já calcula isso para a query. */
  inverted?: boolean;
  label?: string;
}

/**
 * O par de datas como **um** filtro.
 *
 * Separados, os dois ocupavam uma célula do grid cada e preenchiam só 156px
 * dela: sobravam ~100px de vazio depois de cada campo, e nada da segunda linha
 * do painel alinhava com as colunas da primeira. Um intervalo é uma coisa só —
 * agrupá-lo devolve o ritmo do grid e ainda diz ao usuário que os dois campos
 * se leem juntos.
 *
 * Os rótulos "Data Início"/"Data Fim" e "De"/"Até" viravam quatro nomes para
 * dois conceitos entre Pedidos e Movimentações. Aqui é "Período", uma vez só.
 */
export function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  inverted = false,
  label = "Período",
}: DateRangeFilterProps) {
  return (
    <FilterField label={label} span={2}>
      <div className="flex items-center gap-2">
        <Input
          type="date"
          // O `max`/`min` cruzado impede o intervalo invertido já no seletor
          // nativo; a mensagem abaixo cobre quem digita.
          max={to || undefined}
          value={from}
          onChange={(event) => onFromChange(event.target.value)}
          className={cn("h-9", inverted && "border-destructive")}
          aria-label={`${label}: início`}
          aria-invalid={inverted}
        />

        <span className="shrink-0 text-sm text-muted-foreground">até</span>

        <Input
          type="date"
          min={from || undefined}
          value={to}
          onChange={(event) => onToChange(event.target.value)}
          className={cn("h-9", inverted && "border-destructive")}
          aria-label={`${label}: fim`}
          aria-invalid={inverted}
        />
      </div>

      {/* FN-23: um período invertido devolvia lista vazia sem dizer o porquê. */}
      {inverted ? (
        <p className="text-xs text-destructive">
          A data final deve ser posterior à inicial.
        </p>
      ) : null}
    </FilterField>
  );
}
