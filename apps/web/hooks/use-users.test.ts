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

import { useUsers, useRoles, useInviteUser, useUpdateUser, userKeys } from './use-users';

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

describe('userKeys', () => {
  it('should namespace the user queries', () => {
    expect(userKeys.all).toEqual(['users']);
    expect(userKeys.roles()).toEqual(['users', 'roles']);
  });
});

describe('useUsers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should fetch the tenant users', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { data: [{ id: 'u1', email: 'admin@admin.com' }], meta: { total: 1 } },
    } as never);

    const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/users', {
      params: { page: 1, limit: 50 },
    });
    expect(result.current.data?.data[0].email).toBe('admin@admin.com');
  });
});

describe('useRoles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should fetch the real roles of the tenant', async () => {
    // FN-08: the invite needs a real roleId — the screen used to offer four
    // invented slugs and every invite would have been rejected with 400.
    mockedApi.get.mockResolvedValueOnce({
      data: { data: [{ id: 'r1', name: 'seller', label: 'Vendedor' }] },
    } as never);

    const { result } = renderHook(() => useRoles(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/users/roles');
    expect(result.current.data?.[0].label).toBe('Vendedor');
  });
});

describe('useInviteUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should post the invite and return the token', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: { data: { email: 'novo@exemplo.com', token: 'abc123' } },
    } as never);

    const { result } = renderHook(() => useInviteUser(), { wrapper: createWrapper() });

    const invite = await result.current.mutateAsync({
      email: 'novo@exemplo.com',
      roleId: 'r1',
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/users/invite', {
      email: 'novo@exemplo.com',
      roleId: 'r1',
    });
    expect(invite.token).toBe('abc123');
  });
});

describe('useUpdateUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should PATCH only the changed fields', async () => {
    mockedApi.patch.mockResolvedValueOnce({
      data: { data: { id: 'u1', status: 'INACTIVE' } },
    } as never);

    const { result } = renderHook(() => useUpdateUser(), { wrapper: createWrapper() });

    await result.current.mutateAsync({ id: 'u1', status: 'INACTIVE' });

    expect(mockedApi.patch).toHaveBeenCalledWith('/users/u1', {
      status: 'INACTIVE',
    });
  });
});
