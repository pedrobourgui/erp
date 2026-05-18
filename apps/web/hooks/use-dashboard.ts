import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { ApiResponse } from "@erp/shared-types";

// ─── Types ──────────────────────────────────────────────────────────────

export interface DashboardKPI {
  revenue: {
    value: number;
    trend: number;
    sparkline: number[];
  };
  orders: {
    value: number;
    trend: number;
    sparkline: number[];
  };
  avgTicket: {
    value: number;
    trend: number;
    sparkline: number[];
  };
  lowStockAlerts: {
    value: number;
    trend: number;
  };
}

export interface OrdersByStatus {
  status: string;
  label: string;
  count: number;
  color: string;
}

export interface DashboardData {
  kpis: DashboardKPI;
  ordersByStatus: OrdersByStatus[];
}

// ─── Query keys ─────────────────────────────────────────────────────────

export const dashboardKeys = {
  all: ["dashboard"] as const,
  data: () => [...dashboardKeys.all, "data"] as const,
};

// ─── Hook ───────────────────────────────────────────────────────────────

export function useDashboardData() {
  return useQuery({
    queryKey: dashboardKeys.data(),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<DashboardData>>("/reports/dashboard");
      return data;
    },
    staleTime: 60 * 1000,
  });
}
