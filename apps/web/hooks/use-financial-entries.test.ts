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
  useFinancialEntries,
  useCreateFinancialEntry,
  useSettleFinancialEntry,
  financialEntryKeys,
} from './use-financial-entries';

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

describe('financialEntryKeys', () => {
  it('should generate stable query keys', () => {
    expect(financialEntryKeys.all).toEqual(['financial-entries']);
    expect(financialEntryKeys.lists()).toEqual(['financial-entries', 'list']);
    expect(financialEntryKeys.list({ page: 2 })).toEqual([
      'financial-entries',
      'list',
      { page: 2 },
    ]);
  });
});

describe('useFinancialEntries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should fetch entries forwarding filters and return data with totals', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: 'trx-1',
            kind: 'TRANSACTION',
            type: 'REVENUE',
            description: 'Receita manual',
            amount: 100,
            date: '2026-07-05T00:00:00.000Z',
            status: 'PAID',
            accountId: 'acc-1',
            accountName: 'Caixa',
            chartAccountId: null,
            categoryName: null,
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasMore: false },
        totals: { revenue: 100, expense: 0, balance: 100 },
      },
    });

    const { result } = renderHook(
      () =>
        useFinancialEntries({
          type: 'REVENUE',
          status: 'PAID',
          accountId: 'acc-1',
          startDate: '2026-07-01',
          endDate: '2026-07-31',
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedApi.get).toHaveBeenCalledWith('/financial-entries', {
      params: {
        page: 1,
        limit: 20,
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        type: 'REVENUE',
        accountId: 'acc-1',
        status: 'PAID',
      },
    });
    expect(result.current.data?.totals.balance).toBe(100);
    expect(result.current.data?.data).toHaveLength(1);
  });

  it('should omit empty optional filters', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        success: true,
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasMore: false },
        totals: { revenue: 0, expense: 0, balance: 0 },
      },
    });

    const { result } = renderHook(() => useFinancialEntries(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedApi.get).toHaveBeenCalledWith('/financial-entries', {
      params: {
        page: 1,
        limit: 20,
        startDate: undefined,
        endDate: undefined,
        type: undefined,
        accountId: undefined,
        status: undefined,
      },
    });
  });
});

describe('useCreateFinancialEntry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should POST the payload to /financial-entries', async () => {
    mockedApi.post.mockResolvedValue({
      data: { success: true, data: { id: 'rec-1', kind: 'RECEIVABLE' } },
    });

    const { result } = renderHook(() => useCreateFinancialEntry(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      type: 'REVENUE',
      accountId: 'acc-1',
      amount: 900,
      date: '2026-07-08',
      paid: false,
      dueDate: '2026-08-08',
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/financial-entries', {
      type: 'REVENUE',
      accountId: 'acc-1',
      amount: 900,
      date: '2026-07-08',
      paid: false,
      dueDate: '2026-08-08',
    });
  });
});

describe('useSettleFinancialEntry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should POST the settlement to /financial-entries/:id/settle', async () => {
    mockedApi.post.mockResolvedValue({
      data: {
        success: true,
        data: { id: 'ar-1', kind: 'RECEIVABLE', status: 'PAID', settledAmount: 250 },
      },
    });

    const { result } = renderHook(() => useSettleFinancialEntry(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      id: 'ar-1',
      kind: 'RECEIVABLE',
      amount: 250,
      accountId: 'acc-1',
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/financial-entries/ar-1/settle', {
      kind: 'RECEIVABLE',
      amount: 250,
      accountId: 'acc-1',
    });
  });

  it('should omit amount and account so the API settles the full outstanding balance', async () => {
    mockedApi.post.mockResolvedValue({
      data: { success: true, data: { id: 'ap-1', kind: 'PAYABLE', status: 'PAID' } },
    });

    const { result } = renderHook(() => useSettleFinancialEntry(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({ id: 'ap-1', kind: 'PAYABLE' });

    expect(mockedApi.post).toHaveBeenCalledWith('/financial-entries/ap-1/settle', {
      kind: 'PAYABLE',
      amount: undefined,
      accountId: undefined,
    });
  });
});
