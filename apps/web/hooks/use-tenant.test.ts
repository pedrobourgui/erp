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

import { useTenant, useTenantUsage, useUpdateTenant, tenantKeys } from './use-tenant';

const mockedApi = vi.mocked(api);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('tenantKeys', () => {
  it('should namespace the tenant queries', () => {
    expect(tenantKeys.all).toEqual(['tenant']);
    expect(tenantKeys.current()).toEqual(['tenant', 'current']);
    expect(tenantKeys.usage()).toEqual(['tenant', 'usage']);
  });
});

describe('useTenant', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should fetch the current tenant', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { data: { id: 't1', name: 'Loja Exemplo Ltda' } },
    } as never);

    const { result } = renderHook(() => useTenant(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/tenants/current');
    expect(result.current.data?.name).toBe('Loja Exemplo Ltda');
  });

  it('should surface the error instead of an empty tenant', async () => {
    // AE-28: a failed request must not look like "no company registered".
    mockedApi.get.mockRejectedValueOnce(new Error('403'));

    const { result } = renderHook(() => useTenant(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

describe('useTenantUsage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should fetch the plan usage', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        data: {
          plan: 'STARTER',
          limits: [{ key: 'users', label: 'Usuários', current: 2, max: 10 }],
        },
      },
    } as never);

    const { result } = renderHook(() => useTenantUsage(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/tenants/current/usage');
    expect(result.current.data?.limits[0].current).toBe(2);
  });
});

describe('useUpdateTenant', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should PATCH the current tenant', async () => {
    mockedApi.patch.mockResolvedValueOnce({
      data: { data: { id: 't1', name: 'Novo Nome' } },
    } as never);

    const { result } = renderHook(() => useUpdateTenant(), { wrapper: createWrapper() });

    await result.current.mutateAsync({ name: 'Novo Nome' });

    expect(mockedApi.patch).toHaveBeenCalledWith('/tenants/current', {
      name: 'Novo Nome',
    });
  });
});
