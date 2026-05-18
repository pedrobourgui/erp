import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

import api from '@/lib/api';
import { useDashboardData, dashboardKeys } from './use-dashboard';

const mockedApi = vi.mocked(api);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
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

describe('dashboardKeys', () => {
  it('should generate correct query keys', () => {
    expect(dashboardKeys.all).toEqual(['dashboard']);
    expect(dashboardKeys.data()).toEqual(['dashboard', 'data']);
  });
});

describe('useDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch dashboard data from /reports/dashboard', async () => {
    const mockData = {
      data: {
        kpis: {
          revenue: { value: 50000, trend: 12.5, sparkline: [100, 200, 300] },
          orders: { value: 120, trend: 5.2, sparkline: [10, 20, 30] },
          avgTicket: { value: 416.67, trend: -2.1, sparkline: [400, 410, 420] },
          lowStockAlerts: { value: 3, trend: 0 },
        },
        ordersByStatus: [
          { status: 'PENDING', label: 'Pendente', count: 10, color: '#ffc107' },
        ],
      },
    };
    mockedApi.get.mockResolvedValueOnce({ data: mockData });

    const { result } = renderHook(() => useDashboardData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedApi.get).toHaveBeenCalledWith('/reports/dashboard');
    expect(result.current.data).toEqual(mockData);
  });

  it('should handle API error', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('Server down'));

    const { result } = renderHook(() => useDashboardData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });
});
