import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import api from "@/lib/api";
import { financialAccountKeys } from "@/hooks/use-financial-accounts";
import type { PaginatedResponse, ApiResponse } from "@erp/shared-types";

// ─── Types ─────────────────────────────────────────────────────────────

export type FinancialEntryType = "REVENUE" | "EXPENSE";
export type FinancialEntryKind = "TRANSACTION" | "RECEIVABLE" | "PAYABLE";
export type FinancialEntryStatus =
  | "PAID"
  | "PENDING"
  | "PARTIALLY_PAID"
  | "OVERDUE"
  | "CANCELLED"
  | "REFUNDED";
export type FinancialEntryStatusFilter = "PAID" | "OPEN";

export interface FinancialEntry {
  id: string;
  kind: FinancialEntryKind;
  type: FinancialEntryType;
  description: string;
  amount: number;
  date: string;
  status: FinancialEntryStatus;
  accountId: string | null;
  accountName: string | null;
  chartAccountId: string | null;
  categoryName: string | null;
}

export interface FinancialEntriesTotals {
  revenue: number;
  expense: number;
  balance: number;
}

export type FinancialEntriesResponse = PaginatedResponse<FinancialEntry> & {
  totals: FinancialEntriesTotals;
};

// ─── Params ────────────────────────────────────────────────────────────

export interface FinancialEntryListParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  type?: FinancialEntryType;
  accountId?: string;
  status?: FinancialEntryStatusFilter;
}

// ─── Query keys ────────────────────────────────────────────────────────

export const financialEntryKeys = {
  all: ["financial-entries"] as const,
  lists: () => [...financialEntryKeys.all, "list"] as const,
  list: (params: FinancialEntryListParams) =>
    [...financialEntryKeys.lists(), params] as const,
};

// ─── List (SCRUM-11) ───────────────────────────────────────────────────

export function useFinancialEntries(params: FinancialEntryListParams = {}) {
  return useQuery({
    queryKey: financialEntryKeys.list(params),
    queryFn: async () => {
      const { data } = await api.get<FinancialEntriesResponse>(
        "/financial-entries",
        {
          params: {
            page: params.page ?? 1,
            limit: params.limit ?? 20,
            startDate: params.startDate || undefined,
            endDate: params.endDate || undefined,
            type: params.type || undefined,
            accountId: params.accountId || undefined,
            status: params.status || undefined,
          },
        }
      );
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

// ─── Create (SCRUM-10) ─────────────────────────────────────────────────

export interface CreateFinancialEntryPayload {
  type: FinancialEntryType;
  accountId: string;
  chartAccountId?: string;
  amount: number;
  date: string;
  paid?: boolean;
  dueDate?: string;
  description?: string;
}

export function useCreateFinancialEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateFinancialEntryPayload) => {
      const { data } = await api.post<ApiResponse<{ id: string; kind: FinancialEntryKind }>>(
        "/financial-entries",
        payload
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialEntryKeys.lists() });
    },
  });
}

// ─── Settle an open título (SCRUM-31/32) ───────────────────────────────

export type SettleableKind = "RECEIVABLE" | "PAYABLE";

export interface SettleFinancialEntryPayload {
  id: string;
  kind: SettleableKind;
  /** Omit to settle the whole outstanding balance. */
  amount?: number;
  /** Omit to use the account already linked to the título. */
  accountId?: string;
}

export interface SettlementResult {
  id: string;
  kind: SettleableKind;
  status: FinancialEntryStatus;
  amount: number;
  paidAmount: number;
  settledAmount: number;
  accountId: string;
}

export function useSettleFinancialEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, kind, amount, accountId }: SettleFinancialEntryPayload) => {
      const { data } = await api.post<ApiResponse<SettlementResult>>(
        `/financial-entries/${id}/settle`,
        { kind, amount, accountId }
      );
      return data;
    },
    onSuccess: () => {
      // The settlement moves money: the list, its totals and the account
      // balances all change.
      queryClient.invalidateQueries({ queryKey: financialEntryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: financialAccountKeys.all });
    },
  });
}
