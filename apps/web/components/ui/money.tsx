import * as React from "react";

import { cn, formatCurrency } from "@/lib/utils";

/**
 * Valor monetário — o único tratamento de dinheiro da interface.
 *
 * Antes disto conviviam três convenções: `font-mono` no financeiro,
 * `tabular-nums` no dashboard e **nada** em pedidos e produtos. Em Plus Jakarta
 * Sans os dígitos são proporcionais, então uma coluna `text-right` sem
 * `tabular-nums` não alinha dígito com dígito — a vírgula dança de linha em
 * linha e a coluna deixa de ser comparável de relance.
 *
 * Três regras, todas obrigatórias:
 *
 * - `tabular-nums` para os dígitos ocuparem a mesma largura;
 * - `whitespace-nowrap` porque "R$ 89,90" nunca pode virar "R$ 89" (VD-13);
 * - negativo em `text-destructive`, porque um saldo devedor no mesmo preto do
 *   saldo credor é a informação mais importante da linha renderizada como se
 *   fosse a menos.
 *
 * `font-mono` fica reservada a SKU e códigos — a distinção entre "isto é um
 * código" e "isto é dinheiro" já é uma convenção boa do sistema.
 */
export interface MoneyProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number | string | null | undefined;
  /** `false` mantém o negativo na cor do texto (extratos que já usam sinal). */
  signalNegative?: boolean;
}

export function Money({
  value,
  signalNegative = true,
  className,
  ...props
}: MoneyProps) {
  const numeric = Number(value);
  const amount = Number.isFinite(numeric) ? numeric : 0;

  return (
    <span
      className={cn(
        "tabular-nums whitespace-nowrap",
        signalNegative && amount < 0 && "text-destructive",
        className
      )}
      {...props}
    >
      {formatCurrency(amount)}
    </span>
  );
}
