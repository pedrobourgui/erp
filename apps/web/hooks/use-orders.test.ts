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
  useOrders,
  useOrder,
  useUpdateOrderStatus,
  useRecentOrders,
  orderKeys,
} from './use-orders';

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

describe('orderKeys', () => {
  it('should generate correct query keys', () => {
    expect(orderKeys.all).toEqual(['orders']);
    expect(orderKeys.lists()).toEqual(['orders', 'list']);
    expect(orderKeys.list({ status: 'PENDING' as never })).toEqual([
      'orders',
      'list',
      { status: 'PENDING' },
    ]);
    expect(orderKeys.details()).toEqual(['orders', 'detail']);
    expect(orderKeys.detail('o1')).toEqual(['orders', 'detail', 'o1']);
  });
});

describe('useOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch orders with default params', async () => {
    const mockData = {
      data: [{ id: 'o1', customerName: 'John' }],
      meta: { page: 1, limit: 20, total: 1 },
    };
    mockedApi.get.mockResolvedValueOnce({ data: mockData });

    const { result } = renderHook(() => useOrders(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedApi.get).toHaveBeenCalledWith('/orders', {
      params: {
        page: 1,
        limit: 20,
        search: undefined,
        sortBy: undefined,
        sortOrder: undefined,
        status: undefined,
        origin: undefined,
        customerId: undefined,
        dateFrom: undefined,
        dateTo: undefined,
      },
    });
    expect(result.current.data).toEqual(mockData);
  });

  it('should pass custom params including date filters', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { data: [], meta: {} } });

    const { result } = renderHook(
      () =>
        useOrders({
          page: 2,
          limit: 50,
          status: 'SHIPPED' as never,
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedApi.get).toHaveBeenCalledWith('/orders', {
      params: expect.objectContaining({
        page: 2,
        limit: 50,
        status: 'SHIPPED',
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
      }),
    });
  });

  it('should handle API error', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useOrders(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch an order by id', async () => {
    const mockData = { data: { id: 'o1', customerName: 'John' } };
    mockedApi.get.mockResolvedValueOnce({ data: mockData });

    const { result } = renderHook(() => useOrder('o1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedApi.get).toHaveBeenCalledWith('/orders/o1');
    expect(result.current.data).toEqual(mockData);
  });

  it('should not fetch when id is empty', async () => {
    const { result } = renderHook(() => useOrder(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedApi.get).not.toHaveBeenCalled();
  });
});

describe('useUpdateOrderStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should PATCH to /orders/:id/status', async () => {
    const mockResponse = { data: { id: 'o1', status: 'SHIPPED' } };
    mockedApi.patch.mockResolvedValueOnce({ data: mockResponse });

    const { result } = renderHook(() => useUpdateOrderStatus(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      id: 'o1',
      status: 'SHIPPED' as never,
      note: 'Shipped via carrier',
    });

    expect(mockedApi.patch).toHaveBeenCalledWith('/orders/o1/status', {
      status: 'SHIPPED',
      notes: 'Shipped via carrier',
    });
  });

  it('should send notes as undefined when note is not provided', async () => {
    mockedApi.patch.mockResolvedValueOnce({ data: { data: {} } });

    const { result } = renderHook(() => useUpdateOrderStatus(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      id: 'o2',
      status: 'CONFIRMED' as never,
    });

    expect(mockedApi.patch).toHaveBeenCalledWith('/orders/o2/status', {
      status: 'CONFIRMED',
      notes: undefined,
    });
  });
});

describe('useRecentOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch recent orders with default limit of 5', async () => {
    const mockData = { data: [{ id: 'o1' }], meta: { total: 1 } };
    mockedApi.get.mockResolvedValueOnce({ data: mockData });

    const { result } = renderHook(() => useRecentOrders(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedApi.get).toHaveBeenCalledWith('/orders', {
      params: { page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' },
    });
  });

  it('should fetch recent orders with custom limit', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { data: [], meta: {} } });

    const { result } = renderHook(() => useRecentOrders(10), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedApi.get).toHaveBeenCalledWith('/orders', {
      params: { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' },
    });
  });
});
