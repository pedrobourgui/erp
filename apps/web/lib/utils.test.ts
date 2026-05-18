import { describe, it, expect } from 'vitest';
import { cn, formatCurrency, formatDate, formatDateTime } from './utils';

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

  it('should handle NaN', () => {
    const result = formatCurrency(NaN);
    expect(result).toContain('NaN');
  });

  it('should handle fractional cents', () => {
    const result = formatCurrency(10.999);
    expect(result).toContain('R$');
    // Intl rounds to 2 decimals
    expect(result).toContain('11,00');
  });
});

describe('formatDate', () => {
  it('should format an ISO string to dd/MM/yyyy by default', () => {
    expect(formatDate('2024-01-15T10:30:00Z')).toBe('15/01/2024');
  });

  it('should format a Date object', () => {
    const date = new Date(2024, 0, 15); // Jan 15, 2024
    expect(formatDate(date)).toBe('15/01/2024');
  });

  it('should accept a custom pattern', () => {
    // Use a Date object to avoid timezone offset issues with ISO strings
    const date = new Date(2024, 5, 20); // June 20, 2024 in local timezone
    const result = formatDate(date, 'yyyy-MM-dd');
    expect(result).toBe('2024-06-20');
  });

  it('should use pt-BR locale', () => {
    // Month name should be in Portuguese
    const result = formatDate('2024-03-10T00:00:00Z', "dd 'de' MMMM");
    expect(result).toContain('março');
  });
});

describe('formatDateTime', () => {
  it('should format as dd/MM/yyyy HH:mm', () => {
    const result = formatDateTime('2024-01-15T14:30:00Z');
    expect(result).toMatch(/15\/01\/2024/);
    // Time part depends on timezone, but format should include HH:mm
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it('should format a Date object', () => {
    const date = new Date(2024, 5, 20, 9, 15); // Jun 20, 2024 09:15
    const result = formatDateTime(date);
    expect(result).toContain('20/06/2024');
    expect(result).toContain('09:15');
  });
});
