import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import api from "@/lib/api";
import type { Customer, PaginatedResponse, ApiResponse } from "@erp/shared-types";

// ─── Types ──────────────────────────────────────────────────────────────

export type CustomerDocumentType = "CPF" | "CNPJ";
export type CustomerSegment = "regular" | "vip" | "wholesale" | "inactive";

export interface CustomerAddress {
  id?: string;
  label: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  isDefault: boolean;
}

export interface CustomerDetail extends Customer {
  documentType: CustomerDocumentType;
  phone: string;
  segment: CustomerSegment;
  totalOrders: number;
  totalSpent: number;
  addresses: CustomerAddress[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerListItem extends Customer {
  documentType: CustomerDocumentType;
  phone: string;
  segment: CustomerSegment;
  totalOrders: number;
  totalSpent: number;
}

export interface CustomerListParams {
  page?: number;
  limit?: number;
  search?: string;
  segment?: CustomerSegment;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface CustomerFormData {
  documentType: CustomerDocumentType;
  name: string;
  document: string;
  email: string;
  phone: string;
  segment?: CustomerSegment;
}

// ─── Query keys ─────────────────────────────────────────────────────────

export const customerKeys = {
  all: ["customers"] as const,
  lists: () => [...customerKeys.all, "list"] as const,
  list: (params: CustomerListParams) => [...customerKeys.lists(), params] as const,
  details: () => [...customerKeys.all, "detail"] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────

export function useCustomers(params: CustomerListParams = {}) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<CustomerListItem>>("/customers", {
        params: {
          page: params.page ?? 1,
          limit: params.limit ?? 20,
          search: params.search || undefined,
          segment: params.segment || undefined,
          sortBy: params.sortBy || undefined,
          sortOrder: params.sortOrder || undefined,
        },
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useCustomer(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<CustomerDetail>>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<CustomerDetail>>(`/customers/${id}`);
      return data;
    },
    enabled: !!id,
    ...options,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CustomerFormData) => {
      const { data } = await api.post<ApiResponse<CustomerDetail>>("/customers", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: CustomerFormData & { id: string }) => {
      const { data } = await api.patch<ApiResponse<CustomerDetail>>(
        `/customers/${id}`,
        payload
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(variables.id) });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}
