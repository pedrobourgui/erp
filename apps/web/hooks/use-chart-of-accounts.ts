import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

// ─── Types ─────────────────────────────────────────────────────────────

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

export interface ChartAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
}

// ─── Query keys ────────────────────────────────────────────────────────

export const chartOfAccountsKeys = {
  all: ["chart-of-accounts"] as const,
  list: (type?: AccountType) =>
    [...chartOfAccountsKeys.all, "list", type ?? "all"] as const,
};

// ─── Hook ──────────────────────────────────────────────────────────────

export function useChartOfAccounts(type?: AccountType) {
  return useQuery({
    queryKey: chartOfAccountsKeys.list(type),
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: ChartAccount[] }>(
        "/chart-of-accounts",
        { params: { type: type || undefined } }
      );
      return data.data;
    },
  });
}
