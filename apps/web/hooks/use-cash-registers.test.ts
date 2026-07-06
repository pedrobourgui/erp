import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from '@/lib/api';
import {
  useCashRegisterSession,
  useCashRegisterSessions,
  cashRegisterKeys,
} from './use-cash-registers';

const mockedApi = vi.mocked(api);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

describe('cashRegisterKeys', () => {
  it('should generate correct query keys', () => {
    expect(cashRegisterKeys.all).toEqual(['cash-registers']);
    expect(cashRegisterKeys.session('reg-1')).toEqual([
      'cash-registers',
      'session',
      'reg-1',
    ]);
    expect(cashRegisterKeys.sessionList({ status: 'OPEN' })).toEqual([
      'cash-registers',
      'sessions',
      { status: 'OPEN' },
    ]);
  });
});

describe('useCashRegisterSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch the current session keyed by the cash-register id', async () => {
    // SCRUM-8: the endpoint expects the cash-register id, not the session id
    mockedApi.get.mockResolvedValueOnce({
      data: { success: true, data: { id: 'sess-1', status: 'OPEN' } },
    });

    const { result } = renderHook(() => useCashRegisterSession('reg-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedApi.get).toHaveBeenCalledWith('/cash-registers/reg-1/session');
  });

  it('should not fetch when id is empty', () => {
    renderHook(() => useCashRegisterSession(''), { wrapper: createWrapper() });

    expect(mockedApi.get).not.toHaveBeenCalled();
  });
});

describe('useCashRegisterSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch the session history with default pagination', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { data: [], meta: { page: 1, limit: 20, total: 0 } },
    });

    const { result } = renderHook(() => useCashRegisterSessions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedApi.get).toHaveBeenCalledWith('/cash-register-sessions', {
      params: {
        cashRegisterId: undefined,
        status: undefined,
        page: 1,
        limit: 20,
      },
    });
  });

  it('should forward status and pagination params', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { data: [], meta: { page: 2, limit: 5, total: 0 } },
    });

    const { result } = renderHook(
      () => useCashRegisterSessions({ status: 'OPEN', page: 2, limit: 5 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedApi.get).toHaveBeenCalledWith('/cash-register-sessions', {
      params: {
        cashRegisterId: undefined,
        status: 'OPEN',
        page: 2,
        limit: 5,
      },
    });
  });
});
