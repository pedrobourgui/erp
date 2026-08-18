import { type ClassValue, clsx } from "clsx";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null | undefined): string {
  const num = Number(value);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(num) ? num : 0);
}

/**
 * Formats a **civil date** — a day on the calendar, with no time and no
 * timezone: a due date, a competence month, a date picked in `<input
 * type="date">`.
 *
 * FN-02: these were rendered in the browser's local time, so a due date stored
 * at midnight UTC became 21:00 of the previous day in BRT and every screen
 * showed one day less than the user typed. The day is read as written and never
 * converted.
 *
 * For a point in time (`createdAt`, `paidAt`, a status change) use
 * `formatDateTime` instead — those *should* follow the reader's clock.
 */
export function formatDate(
  date: string | Date | null | undefined,
  pattern: string = "dd/MM/yyyy"
): string {
  if (!date) {
    return "";
  }

  // A string is read by its date part alone; a Date by its UTC components.
  // Either way no offset arithmetic takes place, so the day cannot shift.
  const [year, month, day] =
    typeof date === "string"
      ? date.slice(0, 10).split("-").map(Number)
      : [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];

  if (!year || !month || !day) {
    return "";
  }

  return format(new Date(year, month - 1, day), pattern, { locale: ptBR });
}

/**
 * True when both bounds are filled and the period runs backwards (FN-23).
 * Civil dates in `YYYY-MM-DD` compare correctly as plain strings.
 */
export function isInvertedRange(
  from?: string | null,
  to?: string | null
): boolean {
  if (!from || !to) {
    return false;
  }
  return from > to;
}

/**
 * Today as `YYYY-MM-DD`, for `<input type="date">` defaults.
 *
 * `new Date().toISOString().slice(0, 10)` is today in *UTC*: after 21:00 in BRT
 * it already returns tomorrow, and the form opened pre-filled with the wrong
 * day (same family as FN-02).
 */
export function todayDateKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * A civil date as `YYYY-MM-DD`, ready for an `<input type="date">`.
 *
 * Reads the day as written, exactly like `formatDate`: a due date stored as
 * midnight in the tenant timezone must come back into the form as the same day
 * the user typed, never a day earlier (FN-02).
 */
export function toDateInputValue(
  date: string | Date | null | undefined
): string {
  if (!date) {
    return "";
  }
  if (typeof date === "string") {
    return date.slice(0, 10);
  }
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

/**
 * Formats an **instant** — a point in time — in the reader's timezone.
 * Use it for `createdAt`, `paidAt`, shipment and status-history timestamps.
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) {
    return "";
  }
  const parsed = typeof date === "string" ? parseISO(date) : date;
  return format(parsed, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

/**
 * Plural em pt-BR para contagens exibidas na tela.
 *
 * AE-21: o card "Estoque Crítico" dizia "1 itens". É o tipo de detalhe que o
 * usuário nota antes de qualquer bug — e que reaparece toda vez que alguém
 * concatena um número com um substantivo fixo.
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string
): string {
  const word = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${count} ${word}`;
}
