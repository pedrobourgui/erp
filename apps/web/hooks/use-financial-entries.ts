import type { PaginatedResponse, ApiResponse } from "@erp/shared-types";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { financialAccountKeys } from "@/hooks/use-financial-accounts";
import api from "@/lib/api";

// ─── Types ─────────────────────────────────────────────────────────────

/** TRANSFER: as duas pernas de uma transferência interna (FN-12). */
export type FinancialEntryType = "REVENUE" | "EXPENSE" | "TRANSFER";
export type FinancialEntryKind = "TRANSACTION" | "RECEIVABLE" | "PAYABLE";
export type FinancialEntryStatus =
  | "PAID"
  | "PENDING"
  | "PARTIALLY_PAID"
  | "OVERDUE"
  | "CANCELLED"
  | "REFUNDED";
export type FinancialEntryStatusFilter = "PAID" | "OPEN" | "OVERDUE";

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
  /** Nasceu de um pedido ou compra — não é editável pelo financeiro (FN-04). */
  fromDocument: boolean;
}

export interface FinancialEntriesTotals {
  revenue: number;
  expense: number;
  balance: number;
  /** Open receivables already past their due date (FN-03). */
  overdueRevenue: number;
  /** Open payables already past their due date (FN-03). */
  overdueExpense: number;
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

// ─── FN-04: reversibilidade ────────────────────────────────────────────

export interface EntrySettlement {
  id: string;
  amount: number;
  accountId: string;
  description: string;
  settledAt: string;
  isReversed: boolean;
  reversedAt: string | null;
  reversalReason: string | null;
}

/** Baixas de um título, para escolher qual estornar (FN-04). */
export function useEntrySettlements(entryId: string | null) {
  return useQuery({
    queryKey: [...financialEntryKeys.all, "settlements", entryId] as const,
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<EntrySettlement[]>>(
        `/financial-entries/${entryId}/settlements`
      );
      return data.data;
    },
    enabled: !!entryId,
  });
}

export interface ReverseSettlementPayload {
  /** Id do título. */
  id: string;
  /** Id da transação de baixa a estornar. */
  settlementId: string;
  reason: string;
}

export interface UpdateFinancialEntryPayload {
  id: string;
  description?: string;
  amount?: number;
  /** Data civil `YYYY-MM-DD` — nunca um instante. */
  dueDate?: string;
  chartAccountId?: string;
}

export interface DeleteFinancialEntryPayload {
  id: string;
  reason: string;
}

/** Invalida tudo que uma correção de lançamento move: lista, totais e saldos. */
function invalidateFinancial(queryClient: ReturnType<typeof useQueryClient>) {
  // O prefixo inteiro: a lista, os totais e o histórico de baixas mudam juntos.
  queryClient.invalidateQueries({ queryKey: financialEntryKeys.all });
  queryClient.invalidateQueries({ queryKey: financialAccountKeys.all });
}

/**
 * FN-04: estorna uma baixa. O estorno é um lançamento novo — a baixa original
 * continua no extrato, ao lado dele.
 */
export function useReverseSettlement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, settlementId, reason }: ReverseSettlementPayload) => {
      const { data } = await api.post<ApiResponse<SettlementResult>>(
        `/financial-entries/${id}/settlements/${settlementId}/reverse`,
        { reason }
      );
      return data;
    },
    onSuccess: () => invalidateFinancial(queryClient),
  });
}

export function useUpdateFinancialEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateFinancialEntryPayload) => {
      const { data } = await api.patch<ApiResponse<{ id: string }>>(
        `/financial-entries/${id}`,
        payload
      );
      return data;
    },
    onSuccess: () => invalidateFinancial(queryClient),
  });
}

export function useDeleteFinancialEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: DeleteFinancialEntryPayload) => {
      // O motivo vai no corpo mesmo sendo DELETE: é dado de auditoria, não de rota.
      const { data } = await api.delete<ApiResponse<{ id: string }>>(
        `/financial-entries/${id}`,
        { data: { reason } }
      );
      return data;
    },
    onSuccess: () => invalidateFinancial(queryClient),
  });
}
