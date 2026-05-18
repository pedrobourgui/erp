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
  useProducts,
  useProduct,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  productKeys,
} from './use-products';

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

describe('productKeys', () => {
  it('should generate correct query keys', () => {
    expect(productKeys.all).toEqual(['products']);
    expect(productKeys.lists()).toEqual(['products', 'list']);
    expect(productKeys.list({ page: 1 })).toEqual(['products', 'list', { page: 1 }]);
    expect(productKeys.details()).toEqual(['products', 'detail']);
    expect(productKeys.detail('abc')).toEqual(['products', 'detail', 'abc']);
  });
});

describe('useProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch products with default params', async () => {
    const mockData = {
      data: [{ id: '1', name: 'Product 1' }],
      meta: { page: 1, limit: 20, total: 1 },
    };
    mockedApi.get.mockResolvedValueOnce({ data: mockData });

    const { result } = renderHook(() => useProducts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedApi.get).toHaveBeenCalledWith('/products', {
      params: {
        page: 1,
        limit: 20,
        search: undefined,
        sortBy: undefined,
        sortOrder: undefined,
        status: undefined,
        categoryId: undefined,
        brandId: undefined,
      },
    });
    expect(result.current.data).toEqual(mockData);
  });

  it('should pass custom params to the API', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { data: [], meta: {} } });

    const { result } = renderHook(
      () => useProducts({ page: 2, limit: 10, search: 'test', status: 'ACTIVE' as never }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedApi.get).toHaveBeenCalledWith('/products', {
      params: expect.objectContaining({
        page: 2,
        limit: 10,
        search: 'test',
        status: 'ACTIVE',
      }),
    });
  });

  it('should handle API error', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useProducts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });
});

describe('useProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch a product by id', async () => {
    const mockData = { data: { id: '1', name: 'Product 1' } };
    mockedApi.get.mockResolvedValueOnce({ data: mockData });

    const { result } = renderHook(() => useProduct('1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedApi.get).toHaveBeenCalledWith('/products/1');
    expect(result.current.data).toEqual(mockData);
  });

  it('should not fetch when id is empty string', async () => {
    const { result } = renderHook(() => useProduct(''), {
      wrapper: createWrapper(),
    });

    // Should not be loading because enabled is false
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedApi.get).not.toHaveBeenCalled();
  });
});

describe('useCreateProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should POST to /products and return data', async () => {
    const mockResponse = { data: { id: '1', name: 'New Product' } };
    mockedApi.post.mockResolvedValueOnce({ data: mockResponse });

    const { result } = renderHook(() => useCreateProduct(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      name: 'New Product',
      sku: 'SKU-001',
      costPrice: 10,
      salePrice: 20,
      status: 'ACTIVE' as never,
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/products', {
      name: 'New Product',
      sku: 'SKU-001',
      costPrice: 10,
      salePrice: 20,
      status: 'ACTIVE',
    });
  });
});

describe('useUpdateProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should PATCH to /products/:id', async () => {
    const mockResponse = { data: { id: '1', name: 'Updated' } };
    mockedApi.patch.mockResolvedValueOnce({ data: mockResponse });

    const { result } = renderHook(() => useUpdateProduct(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      id: '1',
      name: 'Updated',
      sku: 'SKU-001',
      costPrice: 10,
      salePrice: 25,
      status: 'ACTIVE' as never,
    });

    expect(mockedApi.patch).toHaveBeenCalledWith('/products/1', {
      name: 'Updated',
      sku: 'SKU-001',
      costPrice: 10,
      salePrice: 25,
      status: 'ACTIVE',
    });
  });
});

describe('useDeleteProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should DELETE /products/:id', async () => {
    mockedApi.delete.mockResolvedValueOnce({});

    const { result } = renderHook(() => useDeleteProduct(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync('1');

    expect(mockedApi.delete).toHaveBeenCalledWith('/products/1');
  });
});
