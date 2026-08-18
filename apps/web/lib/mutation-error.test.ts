import { AxiosError } from 'axios';
import { describe, it, expect } from 'vitest';

import { getMutationErrorMessage } from './mutation-error';

/**
 * AE-10 — o QA mediu seis casos em que o backend dizia exatamente o que estava
 * errado e o usuário lia "Tente novamente".
 */

function apiError(status: number, message?: unknown) {
  const error = new AxiosError('request failed');
  error.response = {
    status,
    statusText: '',
    headers: {},
    config: { headers: {} } as never,
    data: message === undefined ? {} : { message },
  };
  return error;
}

const FALLBACK = 'Erro ao criar cliente. Tente novamente.';

describe('getMutationErrorMessage', () => {
  it('shows the backend reason instead of the generic fallback', () => {
    const message = 'Já existe um cliente com o documento "529.982.247-25"';

    expect(getMutationErrorMessage(apiError(409, message), FALLBACK)).toBe(message);
  });

  it.each([
    'Product with SKU "PRD-001" already exists',
    'Cannot delete category: 4 product(s) are still using it',
    'Cannot delete brand: 4 product(s) are still using it',
  ])('passes through the specific message: %s', (message) => {
    expect(getMutationErrorMessage(apiError(409, message), FALLBACK)).toBe(message);
  });

  it('joins a list of validation messages', () => {
    const error = apiError(400, ['Campo A inválido', 'Campo B inválido']);

    expect(getMutationErrorMessage(error, FALLBACK)).toBe(
      'Campo A inválido, Campo B inválido'
    );
  });

  it('turns a 403 into the permission message, not the technical one', () => {
    // O backend responde "Permissão insuficiente para esta ação", que não diz
    // o que fazer a respeito.
    const error = apiError(403, 'Permissão insuficiente para esta ação');

    expect(getMutationErrorMessage(error, FALLBACK)).toMatch(
      /não tem permissão.*administrador/i
    );
  });

  it('hides a 5xx behind the fallback — a stack trace helps nobody', () => {
    expect(getMutationErrorMessage(apiError(500, 'Internal server error'), FALLBACK)).toBe(
      FALLBACK
    );
    expect(getMutationErrorMessage(apiError(502), FALLBACK)).toBe(FALLBACK);
  });

  it('falls back when the response carries no usable message', () => {
    expect(getMutationErrorMessage(apiError(400), FALLBACK)).toBe(FALLBACK);
    expect(getMutationErrorMessage(apiError(409, '   '), FALLBACK)).toBe(FALLBACK);
    expect(getMutationErrorMessage(apiError(400, 42), FALLBACK)).toBe(FALLBACK);
  });

  it('falls back for a network error, which has no response at all', () => {
    expect(getMutationErrorMessage(new AxiosError('Network Error'), FALLBACK)).toBe(
      FALLBACK
    );
  });

  it('falls back for anything that is not an API error', () => {
    expect(getMutationErrorMessage(new Error('boom'), FALLBACK)).toBe(FALLBACK);
    expect(getMutationErrorMessage(null, FALLBACK)).toBe(FALLBACK);
  });
});
