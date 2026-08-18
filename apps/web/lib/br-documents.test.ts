import {
  isValidCPF,
  isValidCNPJ,
  isValidDocument,
  documentTypeOf,
  formatDocument,
  onlyDigits,
} from '@erp/validators';
import { describe, it, expect } from 'vitest';

/**
 * AE-04 / AE-15 — tabela de casos conhecidos, exigida pelo plano do lote 6.
 *
 * O cadastro aceitava `111.111.111-11` porque os dois lados só contavam
 * dígitos. E `12345678909` convivia com `123.456.789-09` como dois clientes,
 * porque a duplicidade era comparada com a máscara.
 */

// CPFs válidos de teste (dígitos verificadores corretos)
const VALID_CPFS = [
  '52998224725',
  '11144477735',
  '12345678909',
  '390.533.447-05',
];

const INVALID_CPFS = [
  '111.111.111-11', // sequência repetida — o caso do QA
  '00000000000',
  '99999999999',
  '12345678900', // dígito verificador errado
  '5299822472', // 10 dígitos
  '529982247251', // 12 dígitos
  '',
  'abcdefghijk',
];

const VALID_CNPJS = ['11222333000181', '11.222.333/0001-81', '04252011000110'];

const INVALID_CNPJS = [
  '11.111.111/1111-11', // sequência repetida — o caso do QA
  '00000000000000',
  '11222333000182', // dígito verificador errado
  '1122233300018', // 13 dígitos
  '',
];

describe('onlyDigits', () => {
  it('strips every mask character', () => {
    expect(onlyDigits('123.456.789-09')).toBe('12345678909');
    expect(onlyDigits('11.222.333/0001-81')).toBe('11222333000181');
  });

  it('is empty for nothing', () => {
    expect(onlyDigits(null)).toBe('');
    expect(onlyDigits(undefined)).toBe('');
  });
});

describe('isValidCPF', () => {
  it.each(VALID_CPFS)('accepts %s', (cpf) => {
    expect(isValidCPF(cpf)).toBe(true);
  });

  it.each(INVALID_CPFS)('rejects %s', (cpf) => {
    expect(isValidCPF(cpf)).toBe(false);
  });

  it('accepts the same number masked or bare', () => {
    expect(isValidCPF('529.982.247-25')).toBe(isValidCPF('52998224725'));
  });
});

describe('isValidCNPJ', () => {
  it.each(VALID_CNPJS)('accepts %s', (cnpj) => {
    expect(isValidCNPJ(cnpj)).toBe(true);
  });

  it.each(INVALID_CNPJS)('rejects %s', (cnpj) => {
    expect(isValidCNPJ(cnpj)).toBe(false);
  });
});

describe('isValidDocument', () => {
  it('follows the declared type', () => {
    expect(isValidDocument('52998224725', 'CPF')).toBe(true);
    // Um CPF válido não é um CNPJ válido
    expect(isValidDocument('52998224725', 'CNPJ')).toBe(false);
  });

  it('falls back to the digit count when no type is given', () => {
    expect(isValidDocument('52998224725')).toBe(true);
    expect(isValidDocument('11222333000181')).toBe(true);
    expect(isValidDocument('123')).toBe(false);
  });
});

describe('documentTypeOf', () => {
  it('reads the type from the length', () => {
    expect(documentTypeOf('529.982.247-25')).toBe('CPF');
    expect(documentTypeOf('11.222.333/0001-81')).toBe('CNPJ');
    expect(documentTypeOf('123')).toBeNull();
  });
});

describe('formatDocument', () => {
  it('formats a stored CPF for display', () => {
    expect(formatDocument('52998224725')).toBe('529.982.247-25');
  });

  it('formats a stored CNPJ for display', () => {
    expect(formatDocument('11222333000181')).toBe('11.222.333/0001-81');
  });

  it('is idempotent on an already formatted value', () => {
    expect(formatDocument('529.982.247-25')).toBe('529.982.247-25');
  });

  it('gives back what it cannot recognise', () => {
    expect(formatDocument('123')).toBe('123');
    expect(formatDocument(null)).toBe('');
  });
});
