import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import api from "@/lib/api";
import type { PaginatedResponse, ApiResponse } from "@erp/shared-types";

// ─── Types ─────────────────────────────────────────────────────────────

export type PaymentMethodType =
  | "CASH"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "PIX"
  | "BOLETO"
  | "BANK_TRANSFER"
  | "CHECK"
  | "OTHER";

export interface PaymentMethod {
  id: string;
  name: string;
  type: PaymentMethodType;
  defaultAccountId: string | null;
  feePercentage: number;
  settlementDays: number;
  requiresAuthorization: boolean;
  fiscalCode: string | null;
  isActive: boolean;
}

// ─── Params ────────────────────────────────────────────────────────────

export interface PaymentMethodListParams {
  search?: string;
  limit?: number;
}

// ─── Query keys ────────────────────────────────────────────────────────

export const paymentMethodKeys = {
  all: ["payment-methods"] as const,
  lists: () => [...paymentMethodKeys.all, "list"] as const,
  list: (params: PaymentMethodListParams) =>
    [...paymentMethodKeys.lists(), params] as const,
};

// ─── Hooks ─────────────────────────────────────────────────────────────

export function usePaymentMethods(params: PaymentMethodListParams = {}) {
  return useQuery({
    queryKey: paymentMethodKeys.list(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<PaymentMethod>>(
        "/payment-methods",
        {
          params: {
            search: params.search || undefined,
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

export interface CreatePaymentMethodPayload {
  name: string;
  type: PaymentMethodType;
  defaultAccountId?: string;
  feePercentage?: number;
  settlementDays?: number;
  requiresAuthorization?: boolean;
  fiscalCode?: string;
  isActive?: boolean;
}

export interface UpdatePaymentMethodPayload extends Partial<CreatePaymentMethodPayload> {
  id: string;
}

export function useCreatePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreatePaymentMethodPayload) => {
      const { data } = await api.post<ApiResponse<PaymentMethod>>(
        "/payment-methods",
        payload
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: paymentMethodKeys.lists(),
      });
    },
  });
}

export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdatePaymentMethodPayload) => {
      const { data } = await api.patch<ApiResponse<PaymentMethod>>(
        `/payment-methods/${id}`,
        payload
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: paymentMethodKeys.lists(),
      });
    },
  });
}
