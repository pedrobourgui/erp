import { describe, it, expect } from 'vitest';

import {
  cn,
  pluralize,
  toDateInputValue,
  formatCurrency,
  formatDate,
  formatDateTime,
  isInvertedRange,
  todayDateKey,
} from './utils';

describe('cn', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('should merge tailwind classes correctly', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('should handle empty inputs', () => {
    expect(cn()).toBe('');
  });

  it('should handle undefined and null inputs', () => {
    expect(cn(undefined, null, 'foo')).toBe('foo');
  });
});

describe('formatCurrency', () => {
  it('should format a positive number as BRL currency', () => {
    const result = formatCurrency(1234.56);
    // Brazilian format: R$ 1.234,56 (with non-breaking space)
    expect(result).toContain('R$');
    expect(result).toContain('1.234,56');
  });

  it('should format zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('R$');
    expect(result).toContain('0,00');
  });

  it('should format negative numbers', () => {
    const result = formatCurrency(-100);
    expect(result).toContain('R$');
    expect(result).toContain('100,00');
  });

  it('should format very large numbers', () => {
    const result = formatCurrency(1000000);
    expect(result).toContain('R$');
    expect(result).toContain('1.000.000,00');
  });

  // The test used to demand "R$ NaN" on screen. `formatCurrency` was hardened
  // during lote 1 to fall back to zero instead — showing NaN to a user is a
  // defect, not a contract — and this test was left behind asserting the old
  // behaviour.
  it('should fall back to zero for a non-finite value', () => {
    expect(formatCurrency(NaN)).toBe(formatCurrency(0));
    expect(formatCurrency(Infinity)).toBe(formatCurrency(0));
  });

  it('should handle fractional cents', () => {
    const result = formatCurrency(10.999);
    expect(result).toContain('R$');
    // Intl rounds to 2 decimals
    expect(result).toContain('11,00');
  });
});

/**
 * FN-02: a *civil date* (a due date, a competence month, a date the user picked
 * in a `<input type="date">`) is a day on the calendar — it has no time and no
 * timezone. Rendering it through the browser's local time turned midnight UTC
 * into 21:00 of the previous day in BRT, and every screen showed one day less.
 *
 * These tests must hold in any timezone; the suite runs under three in CI.
 */
describe('formatDate (civil date)', () => {
  it('should render a plain YYYY-MM-DD as typed', () => {
    expect(formatDate('2026-01-15')).toBe('15/01/2026');
  });

  it('should render midnight UTC as the same day, never the day before', () => {
    expect(formatDate('2026-01-15T00:00:00.000Z')).toBe('15/01/2026');
  });

  // Due dates stored at midnight in BRT arrive as 03:00Z — still the 15th.
  it('should render a date stored at tenant midnight as that day', () => {
    expect(formatDate('2026-01-15T03:00:00.000Z')).toBe('15/01/2026');
  });

  it('should accept a Date and read it in UTC', () => {
    expect(formatDate(new Date('2026-01-15T03:00:00.000Z'))).toBe('15/01/2026');
  });

  it('should accept a custom pattern', () => {
    expect(formatDate('2026-06-20', 'yyyy-MM-dd')).toBe('2026-06-20');
  });

  it('should use the pt-BR locale', () => {
    expect(formatDate('2026-03-10', "dd 'de' MMMM")).toContain('março');
  });

  it('should return an empty string for a missing value', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('')).toBe('');
  });
});

describe('formatDateTime (instant)', () => {
  it('should format as dd/MM/yyyy HH:mm', () => {
    const result = formatDateTime('2026-01-15T14:30:00Z');
    expect(result).toMatch(/15\/01\/2026/);
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it('should format a Date object in local time', () => {
    const date = new Date(2026, 5, 20, 9, 15); // Jun 20, 2026 09:15 local
    const result = formatDateTime(date);
    expect(result).toContain('20/06/2026');
    expect(result).toContain('09:15');
  });

  it('should return an empty string for a missing value', () => {
    expect(formatDateTime(null)).toBe('');
    expect(formatDateTime(undefined)).toBe('');
  });
});


// FN-23: the list came back empty with a generic "Ajuste os filtros" message.
describe('isInvertedRange', () => {
  it('should flag a period that runs backwards', () => {
    expect(isInvertedRange('2026-12-31', '2026-01-01')).toBe(true);
  });

  it('should accept a forward period and a single day', () => {
    expect(isInvertedRange('2026-01-01', '2026-12-31')).toBe(false);
    expect(isInvertedRange('2026-07-31', '2026-07-31')).toBe(false);
  });

  it('should not complain while a bound is still empty', () => {
    expect(isInvertedRange('2026-12-31', '')).toBe(false);
    expect(isInvertedRange(undefined, '2026-01-01')).toBe(false);
    expect(isInvertedRange(null, null)).toBe(false);
  });
});

describe('todayDateKey', () => {
  it('should return the local day, not the UTC day', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    expect(todayDateKey()).toBe(expected);
  });

  it('should be parseable back by formatDate', () => {
    expect(formatDate(todayDateKey())).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});

describe('toDateInputValue', () => {
  it('keeps the civil day of an instant stored at midnight in the tenant timezone', () => {
    // 2026-08-10 00:00 BRT is 03:00Z — the input must show the 10th, not the 9th.
    expect(toDateInputValue('2026-08-10T03:00:00.000Z')).toBe('2026-08-10');
  });

  it('accepts a bare civil date unchanged', () => {
    expect(toDateInputValue('2026-01-15')).toBe('2026-01-15');
  });

  it('reads a Date by its UTC parts, never by the local offset', () => {
    expect(toDateInputValue(new Date('2026-01-15T03:00:00.000Z'))).toBe('2026-01-15');
  });

  it('is empty for nothing', () => {
    expect(toDateInputValue(null)).toBe('');
    expect(toDateInputValue(undefined)).toBe('');
  });
});

describe('pluralize', () => {
  it('uses the singular for exactly one', () => {
    // AE-21: o card dizia "1 itens".
    expect(pluralize(1, 'item', 'itens')).toBe('1 item');
    expect(pluralize(1, 'produto')).toBe('1 produto');
  });

  it('uses the plural for zero and for many', () => {
    expect(pluralize(0, 'item', 'itens')).toBe('0 itens');
    expect(pluralize(12, 'item', 'itens')).toBe('12 itens');
  });

  it('defaults to adding an s when no plural is given', () => {
    expect(pluralize(3, 'produto')).toBe('3 produtos');
  });

  it('handles irregular plurals through the explicit form', () => {
    expect(pluralize(2, 'opção', 'opções')).toBe('2 opções');
  });
});
