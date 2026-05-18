import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import api from "@/lib/api";
import type { PaginatedResponse, ApiResponse } from "@erp/shared-types";

// ─── Types ─────────────────────────────────────────────────────────────

export interface CashRegisterSession {
  id: string;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt?: string;
  operatorId: string;
  openingBalance: number;
  closingBalance?: number;
  notes?: string;
  operator?: { id: string; name: string };
  movements?: CashMovement[];
  salesSummary?: {
    byMethod: { methodName: string; total: number }[];
    grandTotal: number;
  };
}

export interface CashMovement {
  id: string;
  type: "SALE" | "SUPPLY" | "WITHDRAW";
  amount: number;
  reason?: string;
  description?: string;
  createdAt: string;
}

export interface CashRegister {
  id: string;
  name: string;
  financialAccountId: string;
  isActive: boolean;
  currentSession?: CashRegisterSession;
}

export interface CreateCashRegisterPayload {
  name: string;
  financialAccountId: string;
}

// ─── Params ────────────────────────────────────────────────────────────

export interface CashRegisterSessionListParams {
  cashRegisterId?: string;
  status?: "OPEN" | "CLOSED";
  page?: number;
  limit?: number;
}

// ─── Query keys ────────────────────────────────────────────────────────

export const cashRegisterKeys = {
  all: ["cash-registers"] as const,
  lists: () => [...cashRegisterKeys.all, "list"] as const,
  list: () => [...cashRegisterKeys.lists()] as const,
  sessions: () => [...cashRegisterKeys.all, "sessions"] as const,
  sessionList: (params: CashRegisterSessionListParams) =>
    [...cashRegisterKeys.sessions(), params] as const,
  session: (id: string) =>
    [...cashRegisterKeys.all, "session", id] as const,
};

// ─── Hooks ─────────────────────────────────────────────────────────────

interface CashRegisterRaw {
  id: string;
  name: string;
  financialAccountId: string;
  isActive: boolean;
  sessions?: CashRegisterSession[];
  currentSession?: CashRegisterSession;
}

export function useCashRegisters() {
  return useQuery({
    queryKey: cashRegisterKeys.list(),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<CashRegisterRaw>>(
        "/cash-registers"
      );
      return {
        ...data,
        data: data.data.map((reg) => ({
          ...reg,
          currentSession: reg.currentSession ?? reg.sessions?.[0] ?? undefined,
        })) as CashRegister[],
      };
    },
  });
}

export function useCreateCashRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateCashRegisterPayload) => {
      const { data } = await api.post<ApiResponse<CashRegister>>(
        "/cash-registers",
        payload
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: cashRegisterKeys.lists(),
      });
    },
  });
}

export function useOpenCashRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      openingBalance,
    }: {
      id: string;
      openingBalance: number;
    }) => {
      const { data } = await api.post<ApiResponse<CashRegisterSession>>(
        `/cash-registers/${id}/open`,
        { openingBalance }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: cashRegisterKeys.lists(),
      });
    },
  });
}

export function useCloseCashRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      closingBalance,
      notes,
    }: {
      id: string;
      closingBalance: number;
      notes?: string;
    }) => {
      const { data } = await api.post<ApiResponse<CashRegisterSession>>(
        `/cash-registers/${id}/close`,
        { closingBalance, notes }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: cashRegisterKeys.lists(),
      });
    },
  });
}

export function useCashSupply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      amount,
      reason,
    }: {
      id: string;
      amount: number;
      reason: string;
    }) => {
      const { data } = await api.post<ApiResponse<CashMovement>>(
        `/cash-registers/${id}/supply`,
        { amount, reason }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: cashRegisterKeys.lists(),
      });
    },
  });
}

export function useCashWithdraw() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      amount,
      reason,
    }: {
      id: string;
      amount: number;
      reason: string;
    }) => {
      const { data } = await api.post<ApiResponse<CashMovement>>(
        `/cash-registers/${id}/withdraw`,
        { amount, reason }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: cashRegisterKeys.lists(),
      });
    },
  });
}

export function useCashRegisterSession(id: string) {
  return useQuery({
    queryKey: cashRegisterKeys.session(id),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<CashRegisterSession>>(
        `/cash-registers/${id}/session`
      );
      return data;
    },
    enabled: !!id,
  });
}

export function useCashRegisterSessions(
  params: CashRegisterSessionListParams = {}
) {
  return useQuery({
    queryKey: cashRegisterKeys.sessionList(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<CashRegisterSession>>(
        "/cash-register-sessions",
        {
          params: {
            cashRegisterId: params.cashRegisterId || undefined,
            status: params.status || undefined,
            page: params.page ?? 1,
            limit: params.limit ?? 20,
          },
        }
      );
      return data;
    },
    placeholderData: (prev) => prev,
  });
}
