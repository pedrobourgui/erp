import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import api from "@/lib/api";
import type { PaginatedResponse, ApiResponse } from "@erp/shared-types";

// ─── Types ─────────────────────────────────────────────────────────────

export type BankAccountType = "CHECKING" | "SAVINGS" | "CASH" | "DIGITAL";

export interface FinancialAccount {
  id: string;
  name: string;
  type: BankAccountType;
  code: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccount: string | null;
  balance: number;
  isActive: boolean;
  acceptsDirectSales: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    cashRegisters: number;
    paymentMethods: number;
  };
}

// ─── Params ────────────────────────────────────────────────────────────

export interface FinancialAccountListParams {
  search?: string;
  type?: BankAccountType;
  isActive?: boolean;
  limit?: number;
}

// ─── Query keys ────────────────────────────────────────────────────────

export const financialAccountKeys = {
  all: ["financial-accounts"] as const,
  lists: () => [...financialAccountKeys.all, "list"] as const,
  list: (params: FinancialAccountListParams) =>
    [...financialAccountKeys.lists(), params] as const,
  detail: (id: string) => [...financialAccountKeys.all, "detail", id] as const,
};

// ─── Hooks ─────────────────────────────────────────────────────────────

export function useFinancialAccounts(params: FinancialAccountListParams = {}) {
  return useQuery({
    queryKey: financialAccountKeys.list(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<FinancialAccount>>(
        "/financial-accounts",
        {
          params: {
            search: params.search || undefined,
            type: params.type || undefined,
            isActive: params.isActive,
            limit: params.limit ?? 100,
          },
        }
      );
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────

export interface CreateFinancialAccountPayload {
  name: string;
  type: BankAccountType;
  code?: string;
  bankName?: string;
  bankBranch?: string;
  bankAccount?: string;
  acceptsDirectSales?: boolean;
  isActive?: boolean;
}

export interface UpdateFinancialAccountPayload
  extends Partial<CreateFinancialAccountPayload> {
  id: string;
}

export function useCreateFinancialAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateFinancialAccountPayload) => {
      const { data } = await api.post<ApiResponse<FinancialAccount>>(
        "/financial-accounts",
        payload
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: financialAccountKeys.lists(),
      });
    },
  });
}

export function useUpdateFinancialAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateFinancialAccountPayload) => {
      const { data } = await api.patch<ApiResponse<FinancialAccount>>(
        `/financial-accounts/${id}`,
        payload
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: financialAccountKeys.lists(),
      });
    },
  });
}
