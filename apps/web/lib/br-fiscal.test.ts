import {
  isValidNCM,
  formatNCM,
  isValidCEST,
  isValidGTIN,
  isValidCFOP,
  isSaleCFOP,
  COMMON_SALE_CFOPS,
} from '@erp/validators';
import { describe, it, expect } from 'vitest';

/**
 * AE-08 — o QA cadastrou `ncm: 'ABCDEFG'` e `ean: '123'` sem um aviso sequer.
 * Em produção isso é NF-e rejeitada pela SEFAZ, descoberta na hora de faturar.
 */

describe('isValidNCM', () => {
  it('accepts 8 digits, masked or bare', () => {
    expect(isValidNCM('61091000')).toBe(true);
    expect(isValidNCM('6109.10.00')).toBe(true);
  });

  it.each(['ABCDEFG', '123', '123456789', '', null, undefined])(
    'rejects %s',
    (value) => {
      expect(isValidNCM(value as string)).toBe(false);
    },
  );
});

describe('formatNCM', () => {
  it('formats for display', () => {
    expect(formatNCM('61091000')).toBe('6109.10.00');
  });

  it('gives back what it cannot format', () => {
    expect(formatNCM('123')).toBe('123');
  });
});

describe('isValidCEST', () => {
  it('accepts 7 digits', () => {
    expect(isValidCEST('2803800')).toBe(true);
    expect(isValidCEST('28.038.00')).toBe(true);
  });

  it('rejects other lengths', () => {
    expect(isValidCEST('280380')).toBe(false);
    expect(isValidCEST('28038000')).toBe(false);
  });
});

describe('isValidGTIN', () => {
  // Códigos reais, com dígito verificador correto
  it.each([
    '7891234567895', // EAN-13
    '7896004802411', // EAN-13
    '96385074', // EAN-8
    '036000291452', // UPC-12
    '17891234567892', // GTIN-14
  ])('accepts %s', (gtin) => {
    expect(isValidGTIN(gtin)).toBe(true);
  });

  it('rejects the case the QA typed', () => {
    expect(isValidGTIN('123')).toBe(false);
  });

  it.each([
    '7891234567890', // dígito verificador errado
    '789123456789', // 12 dígitos mas checksum inválido para UPC
    '00000000', // tudo zero
    'ABCDEFGHIJKLM',
    '',
  ])('rejects %s', (gtin) => {
    expect(isValidGTIN(gtin)).toBe(false);
  });

  it('ignores mask characters', () => {
    expect(isValidGTIN('789-1234-567895')).toBe(true);
  });
});

describe('isValidCFOP', () => {
  it.each(COMMON_SALE_CFOPS.map((c) => c.code))('accepts the common code %s', (code) => {
    expect(isValidCFOP(code)).toBe(true);
  });

  it('accepts an inbound CFOP too — the field is not sale-only', () => {
    expect(isValidCFOP('1102')).toBe(true);
  });

  it.each(['4102', '8102', '510', '51022', 'ABCD', ''])('rejects %s', (code) => {
    expect(isValidCFOP(code)).toBe(false);
  });
});

describe('isSaleCFOP', () => {
  it('recognises an outbound operation', () => {
    expect(isSaleCFOP('5102')).toBe(true);
    expect(isSaleCFOP('6108')).toBe(true);
  });

  it('does not call an inbound one a sale', () => {
    expect(isSaleCFOP('1102')).toBe(false);
  });
});

describe('COMMON_SALE_CFOPS', () => {
  it('lists only valid outbound codes', () => {
    for (const { code, description } of COMMON_SALE_CFOPS) {
      expect(isSaleCFOP(code)).toBe(true);
      expect(description.length).toBeGreaterThan(5);
    }
  });
});
