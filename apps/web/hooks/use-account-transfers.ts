import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { ApiResponse } from "@erp/shared-types";
import { financialAccountKeys } from "@/hooks/use-financial-accounts";

// ─── Types ─────────────────────────────────────────────────────────────

export interface CreateAccountTransferPayload {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date?: string;
  description?: string;
}

export interface AccountTransferResult {
  transferId: string;
  amount: number;
  description: string;
  date: string;
  fromAccountId: string;
  toAccountId: string;
  sourceBalance: number;
  destinationBalance: number;
  debitTransactionId: string;
  creditTransactionId: string;
}

// ─── Mutation ──────────────────────────────────────────────────────────

export function useCreateAccountTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateAccountTransferPayload) => {
      const { data } = await api.post<ApiResponse<AccountTransferResult>>(
        "/financial-accounts/transfer",
        payload
      );
      return data;
    },
    onSuccess: () => {
      // Both account balances change, plus the transactions/lançamentos list.
      queryClient.invalidateQueries({ queryKey: financialAccountKeys.all });
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
    },
  });
}
