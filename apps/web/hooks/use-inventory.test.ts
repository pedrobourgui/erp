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
  useInventoryItems,
  useStockMovements,
  useWarehouses,
  useStockAlerts,
  useCreateMovement,
  useCreateWarehouse,
  useSetMinStock,
  inventoryKeys,
} from './use-inventory';

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

describe('inventoryKeys', () => {
  it('should generate correct query keys', () => {
    expect(inventoryKeys.all).toEqual(['inventory']);
    expect(inventoryKeys.items({ page: 1 })).toEqual(['inventory', 'items', { page: 1 }]);
    expect(inventoryKeys.movements({ page: 1 })).toEqual(['inventory', 'movements', { page: 1 }]);
    expect(inventoryKeys.warehouses()).toEqual(['inventory', 'warehouses']);
    expect(inventoryKeys.alerts({ status: 'ACTIVE' })).toEqual([
      'inventory',
      'alerts',
      { status: 'ACTIVE' },
    ]);
  });
});

describe('useInventoryItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch inventory items with default params', async () => {
    const mockData = { data: [{ id: 'i1' }], meta: { total: 1 } };
    mockedApi.get.mockResolvedValueOnce({ data: mockData });

    const { result } = renderHook(() => useInventoryItems(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedApi.get).toHaveBeenCalledWith('/inventory', { params: {} });
    expect(result.current.data).toEqual(mockData);
  });

  it('should pass custom params', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { data: [], meta: {} } });

    const { result } = renderHook(
      () => useInventoryItems({ warehouseId: 'w1', page: 2 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedApi.get).toHaveBeenCalledWith('/inventory', {
      params: { warehouseId: 'w1', page: 2 },
    });
  });

  it('should handle API error', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('fail'));

    const { result } = renderHook(() => useInventoryItems(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useStockMovements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch movements with default params', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { data: [], meta: {} } });

    const { result } = renderHook(() => useStockMovements(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedApi.get).toHaveBeenCalledWith('/inventory/movements', {
      params: {
        page: 1,
        limit: 20,
        type: undefined,
        reason: undefined,
        productId: undefined,
        warehouseId: undefined,
        dateFrom: undefined,
        dateTo: undefined,
      },
    });
  });

  // SCRUM-36: the reason filter existed in the UI but was never sent
  it('should forward the reason filter to the API', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { data: [], meta: {} } });

    const { result } = renderHook(() => useStockMovements({ reason: 'SALE' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedApi.get).toHaveBeenCalledWith(
      '/inventory/movements',
      expect.objectContaining({
        params: expect.objectContaining({ reason: 'SALE' }),
      })
    );
  });

  it('should pass movement type and warehouse filters', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { data: [], meta: {} } });

    const { result } = renderHook(
      () =>
        useStockMovements({
          type: 'ENTRY',
          warehouseId: 'w1',
          page: 2,
          limit: 50,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedApi.get).toHaveBeenCalledWith('/inventory/movements', {
      params: expect.objectContaining({
        page: 2,
        limit: 50,
        type: 'ENTRY',
        warehouseId: 'w1',
      }),
    });
  });
});

describe('useWarehouses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch warehouses', async () => {
    const mockData = { data: [{ id: 'w1', name: 'Main Warehouse' }] };
    mockedApi.get.mockResolvedValueOnce({ data: mockData });

    const { result } = renderHook(() => useWarehouses(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedApi.get).toHaveBeenCalledWith('/inventory/warehouses');
    expect(result.current.data).toEqual(mockData);
  });
});

describe('useStockAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch stock alerts with default params', async () => {
    const mockData = { data: [{ id: 'a1', status: 'ACTIVE' }], meta: { total: 1 } };
    mockedApi.get.mockResolvedValueOnce({ data: mockData });

    const { result } = renderHook(() => useStockAlerts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedApi.get).toHaveBeenCalledWith('/inventory/alerts', { params: {} });
    expect(result.current.data).toEqual(mockData);
  });

  it('should pass status param to the API', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { data: [], meta: {} } });

    const { result } = renderHook(
      () => useStockAlerts({ status: 'ACTIVE', page: 1, limit: 10 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedApi.get).toHaveBeenCalledWith('/inventory/alerts', {
      params: { status: 'ACTIVE', page: 1, limit: 10 },
    });
  });
});

describe('useCreateMovement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should POST to /inventory/movement', async () => {
    const mockResponse = { data: { id: 'm1' } };
    mockedApi.post.mockResolvedValueOnce({ data: mockResponse });

    const { result } = renderHook(() => useCreateMovement(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      productId: 'p1',
      toWarehouseId: 'w1',
      type: 'ENTRY',
      reason: 'PURCHASE',
      quantity: 100,
      notes: 'Initial stock',
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/inventory/movement', {
      productId: 'p1',
      toWarehouseId: 'w1',
      type: 'ENTRY',
      reason: 'PURCHASE',
      quantity: 100,
      notes: 'Initial stock',
    });
  });

  it('should POST an EXIT movement with fromWarehouseId', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { data: { id: 'm2' } } });

    const { result } = renderHook(() => useCreateMovement(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      productId: 'p1',
      fromWarehouseId: 'w1',
      type: 'EXIT',
      reason: 'DAMAGE',
      quantity: 5,
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/inventory/movement', {
      productId: 'p1',
      fromWarehouseId: 'w1',
      type: 'EXIT',
      reason: 'DAMAGE',
      quantity: 5,
    });
  });
});

describe('useSetMinStock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should PATCH the item min-stock endpoint', async () => {
    mockedApi.patch.mockResolvedValueOnce({ data: { data: { id: 'ii-1', minStock: 10 } } });

    const { result } = renderHook(() => useSetMinStock(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({ itemId: 'ii-1', minStock: 10 });

    expect(mockedApi.patch).toHaveBeenCalledWith('/inventory/items/ii-1/min-stock', {
      minStock: 10,
    });
  });
});

describe('useCreateWarehouse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should POST to /inventory/warehouses', async () => {
    const mockResponse = { data: { id: 'w2', name: 'New WH' } };
    mockedApi.post.mockResolvedValueOnce({ data: mockResponse });

    const { result } = renderHook(() => useCreateWarehouse(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      name: 'New WH',
      address: '123 Main St',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01001-000',
      isDefault: false,
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/inventory/warehouses', {
      name: 'New WH',
      address: '123 Main St',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01001-000',
      isDefault: false,
    });
  });
});
