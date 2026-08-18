import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  useCloseCashRegister,
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

// ─── FN-11: fechar o caixa tem que atualizar o histórico de sessões ──────

describe('cash register mutations invalidate the session history', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invalidates the whole cash-registers prefix when a session closes', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { success: true, data: {} } });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useCloseCashRegister(), { wrapper });
    await result.current.mutateAsync({ id: 'reg-1', closingBalance: 100 });

    // Invalidating only `lists()` left `sessionList(params)` untouched: the
    // operator closed the register and the table still read "Aberto".
    expect(spy).toHaveBeenCalledWith({ queryKey: cashRegisterKeys.all });
  });
});
