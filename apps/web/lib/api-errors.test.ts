import { AxiosError } from 'axios';
import { describe, it, expect } from 'vitest';

import { isPermissionError, getApiErrorStatus } from './api-errors';

function axiosErrorWithStatus(status: number, message?: string) {
  const error = new AxiosError('request failed');
  error.response = {
    status,
    statusText: '',
    headers: {},
    config: { headers: {} } as never,
    data: message ? { message } : {},
  };
  return error;
}

/**
 * AE-28: `/financeiro/contas` rendered a 403 as "Nenhuma conta financeira
 * cadastrada" with six accounts in the database. Telling the two apart starts
 * here — a list may only draw its empty state for a request that *succeeded*.
 */
describe('getApiErrorStatus', () => {
  it('reads the HTTP status of an axios error', () => {
    expect(getApiErrorStatus(axiosErrorWithStatus(403))).toBe(403);
  });

  it('is undefined for anything else', () => {
    expect(getApiErrorStatus(new Error('boom'))).toBeUndefined();
    expect(getApiErrorStatus(null)).toBeUndefined();
    expect(getApiErrorStatus(undefined)).toBeUndefined();
  });

  it('is undefined for a network error with no response', () => {
    expect(getApiErrorStatus(new AxiosError('Network Error'))).toBeUndefined();
  });
});

describe('isPermissionError', () => {
  it('is true for 403', () => {
    expect(isPermissionError(axiosErrorWithStatus(403))).toBe(true);
  });

  it('is false for 401 — that is an expired session, not a missing permission', () => {
    expect(isPermissionError(axiosErrorWithStatus(401))).toBe(false);
  });

  it('is false for 404 and 500', () => {
    expect(isPermissionError(axiosErrorWithStatus(404))).toBe(false);
    expect(isPermissionError(axiosErrorWithStatus(500))).toBe(false);
  });

  it('is false when there is no error at all', () => {
    expect(isPermissionError(null)).toBe(false);
  });
});
