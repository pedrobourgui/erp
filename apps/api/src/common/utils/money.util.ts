import { Prisma } from '@prisma/client';

/**
 * Money arithmetic for the API boundary.
 *
 * FN-28: `computeTotals` added `Number(Decimal)` values straight up and the API
 * answered `"balance": 708.9000000000001`. Binary floats cannot represent most
 * cent values, so every addition drifts. The database stores cents — so every
 * sum that reaches a response body goes through cents too.
 *
 * Rule of thumb: **read as Decimal, add as integer cents, expose as a number
 * with two decimals.** For per-order arithmetic use `roundMoney` and friends
 * from `@erp/validators`, which the frontend shares.
 */

export type MoneyLike = Prisma.Decimal | number | string | null | undefined;

/** Integer cents of a money-ish value. Anything unusable is zero. */
export function toCents(value: MoneyLike): number {
  if (value === null || value === undefined) return 0;
  const asNumber = typeof value === 'number' ? value : Number(value.toString());
  if (!Number.isFinite(asNumber)) return 0;
  // `Math.round` alone drops the sign convention on .5 for negatives
  // (`Math.round(-0.5) === -0`), which would make a reversal off by a cent.
  const cents = asNumber * 100;
  return cents < 0 ? -Math.round(-cents) : Math.round(cents);
}

/** Cents back to reais, with exactly two decimals. */
export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

/** A money-ish value as a number with two decimals — safe to serialize. */
export function toMoney(value: MoneyLike): number {
  return fromCents(toCents(value));
}

/** Sum of money values, computed in cents so it cannot drift. */
export function sumMoney(values: MoneyLike[]): number {
  return fromCents(values.reduce<number>((acc, value) => acc + toCents(value), 0));
}

/** `a - b` in cents. Negative results are kept — callers decide if that is legal. */
export function subtractMoney(a: MoneyLike, b: MoneyLike): number {
  return fromCents(toCents(a) - toCents(b));
}

/**
 * Valor como o usuário lê na tela — para mensagens de erro.
 *
 * VD-19: `toFixed(2)` produz "11730.00", com ponto decimal e sem separador de
 * milhar. Numa mensagem voltada ao operador isso é ruído; ele lê R$ 11.730,00.
 */
export function formatBRL(value: MoneyLike): string {
  return toMoney(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
