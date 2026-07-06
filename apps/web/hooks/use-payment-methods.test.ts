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
  usePaymentMethods,
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
  paymentMethodKeys,
} from './use-payment-methods';

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

describe('paymentMethodKeys', () => {
  it('should generate correct query keys', () => {
    expect(paymentMethodKeys.all).toEqual(['payment-methods']);
    expect(paymentMethodKeys.lists()).toEqual(['payment-methods', 'list']);
  });
});

describe('usePaymentMethods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch payment methods', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { data: [{ id: 'pm1', name: 'PIX' }], meta: { total: 1 } },
    });

    const { result } = renderHook(() => usePaymentMethods(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedApi.get).toHaveBeenCalledWith('/payment-methods', {
      params: { search: undefined, limit: 100 },
    });
  });
});

describe('useCreatePaymentMethod', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should POST a payment method linked to a financial account (defaultAccountId)', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { data: { id: 'pm2' } } });

    const { result } = renderHook(() => useCreatePaymentMethod(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      name: 'Cartão Visa',
      type: 'CREDIT_CARD',
      defaultAccountId: 'acc-1',
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/payment-methods', {
      name: 'Cartão Visa',
      type: 'CREDIT_CARD',
      defaultAccountId: 'acc-1',
    });
  });
});

describe('useUpdatePaymentMethod', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should PATCH the account link and not send the id in the body', async () => {
    mockedApi.patch.mockResolvedValueOnce({ data: { data: { id: 'pm3' } } });

    const { result } = renderHook(() => useUpdatePaymentMethod(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({ id: 'pm3', defaultAccountId: 'acc-2' });

    expect(mockedApi.patch).toHaveBeenCalledWith('/payment-methods/pm3', {
      defaultAccountId: 'acc-2',
    });
  });
});
