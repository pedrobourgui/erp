import { describe, it, expect } from 'vitest';

import {
  countErrorsByTab,
  firstTabWithError,
  totalErrorCount,
  invalidSubmitMessage,
} from './form-tabs';

/**
 * AE-11: "Publicar Produto" não fazia nada porque o erro estava numa aba
 * oculta. Estes testes fixam o comportamento que impede isso de voltar.
 */

const FIELDS_BY_TAB = {
  geral: ['name', 'sku', 'category'],
  precos: ['costPrice', 'salePrice'],
  fiscal: ['ncm', 'ean', 'cfop'],
};

const TAB_ORDER = ['geral', 'precos', 'fiscal'];

describe('countErrorsByTab', () => {
  it('counts the errors of each tab', () => {
    const errors = { salePrice: {}, ncm: {}, ean: {} };

    expect(countErrorsByTab(errors, FIELDS_BY_TAB)).toEqual({
      precos: 1,
      fiscal: 2,
    });
  });

  it('omits tabs with no error', () => {
    expect(countErrorsByTab({ name: {} }, FIELDS_BY_TAB)).toEqual({ geral: 1 });
  });

  it('is empty when the form is valid', () => {
    expect(countErrorsByTab({}, FIELDS_BY_TAB)).toEqual({});
  });

  it('ignores an error on a field that belongs to no tab', () => {
    expect(countErrorsByTab({ root: {} }, FIELDS_BY_TAB)).toEqual({});
  });
});

describe('firstTabWithError', () => {
  it('follows the order the tabs appear on screen, not the order of the errors', () => {
    // O erro do fiscal foi reportado primeiro, mas Preços vem antes na tela.
    const errors = { ncm: {}, salePrice: {} };

    expect(firstTabWithError(errors, FIELDS_BY_TAB, TAB_ORDER)).toBe('precos');
  });

  it('is the exact case of AE-11: name and sku filled, price missing', () => {
    expect(
      firstTabWithError({ salePrice: {} }, FIELDS_BY_TAB, TAB_ORDER),
    ).toBe('precos');
  });

  it('is null when nothing is wrong', () => {
    expect(firstTabWithError({}, FIELDS_BY_TAB, TAB_ORDER)).toBeNull();
  });
});

describe('totalErrorCount', () => {
  it('counts every field with an error', () => {
    expect(totalErrorCount({ name: {}, salePrice: {} })).toBe(2);
    expect(totalErrorCount({})).toBe(0);
  });
});

describe('invalidSubmitMessage', () => {
  it('uses the singular for one field', () => {
    expect(invalidSubmitMessage(1)).toMatch(/Existe um campo/);
  });

  it('uses the plural, with the count, for more', () => {
    expect(invalidSubmitMessage(3)).toMatch(/Existem 3 campos/);
  });

  it('never says "0 campos"', () => {
    expect(invalidSubmitMessage(0)).toMatch(/Existe um campo/);
  });
});
