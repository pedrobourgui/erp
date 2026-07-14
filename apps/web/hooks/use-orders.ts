import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import api from "@/lib/api";
import type {
  Order,
  OrderStatus,
  OrderOrigin,
  PaginatedResponse,
  ApiResponse,
} from "@erp/shared-types";

// ─── Extended order types for frontend ──────────────────────────────────

export interface OrderListItem extends Order {
  customerName?: string;
  customer?: { id: string; name: string; email?: string };
  createdAt: string;
  itemCount: number;
  marketplace?: string;
}

export interface OrderPayment {
  id: string;
  paymentMethod: { id: string; name: string; type: string };
  paymentCondition?: { id: string; name: string; code: string };
  financialAccount?: { id: string; name: string };
  amount: number;
  installments?: number;
  authorizationCode?: string;
}

export interface OrderDetail extends OrderListItem {
  items: OrderItem[];
  customer: OrderCustomer;
  shipping: OrderShipping;
  payments?: OrderPayment[];
  receivables: OrderReceivable[];
  history: OrderHistoryEntry[];
  sellerName?: string;
  notes?: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  totalPrice: number;
  imageUrl?: string;
  product?: { id: string; name: string; sku: string };
}

export interface CustomerAddress {
  id?: string;
  label?: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  isDefault?: boolean;
}

export interface OrderCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  addresses?: CustomerAddress[];
}

export interface OrderShipping {
  carrier: string;
  method: string;
  trackingCode?: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cost: number;
}

export interface OrderReceivable {
  id: string;
  description?: string;
  installment?: number;
  totalInstallments?: number;
  dueDate: string;
  amount: number;
  paidAmount?: number;
  status: string;
  method?: string;
  paymentMethod?: { name: string };
  paidAt?: string;
}

export interface OrderHistoryEntry {
  id: string;
  status: OrderStatus;
  note?: string;
  userName: string;
  createdAt: string;
}

// ─── Params ─────────────────────────────────────────────────────────────

export interface OrderListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  status?: OrderStatus;
  origin?: OrderOrigin;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ─── Query keys ─────────────────────────────────────────────────────────

export const orderKeys = {
  all: ["orders"] as const,
  lists: () => [...orderKeys.all, "list"] as const,
  list: (params: OrderListParams) => [...orderKeys.lists(), params] as const,
  details: () => [...orderKeys.all, "detail"] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────

export function useOrders(params: OrderListParams = {}) {
  return useQuery({
    queryKey: orderKeys.list(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<OrderListItem>>(
        "/orders",
        {
          params: {
            page: params.page ?? 1,
            limit: params.limit ?? 20,
            search: params.search || undefined,
            sortBy: params.sortBy || undefined,
            sortOrder: params.sortOrder || undefined,
            status: params.status || undefined,
            origin: params.origin || undefined,
            customerId: params.customerId || undefined,
            dateFrom: params.dateFrom || undefined,
            dateTo: params.dateTo || undefined,
          },
        }
      );
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useOrder(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<OrderDetail>>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<OrderDetail>>(
        `/orders/${id}`
      );
      return data;
    },
    enabled: !!id,
    ...options,
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      note,
    }: {
      id: string;
      status: OrderStatus;
      note?: string;
    }) => {
      const { data } = await api.patch<ApiResponse<Order>>(
        `/orders/${id}/status`,
        { status, notes: note }
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: orderKeys.detail(variables.id),
      });
    },
  });
}

// ─── Create order ──────────────────────────────────────────────────────

export interface CreateOrderItemPayload {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export interface CreateOrderPaymentPayload {
  paymentMethodId: string;
  paymentConditionId?: string;
  financialAccountId?: string;
  amount: number;
  installments?: number;
  authorizationCode?: string;
}

export interface CreateOrderPayload {
  customerId?: string;
  origin: "MANUAL" | "BALCAO";
  items: CreateOrderItemPayload[];
  payments?: CreateOrderPaymentPayload[];
  shippingMethod?: string;
  shippingCost: number;
  notes?: string;
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateOrderPayload) => {
      const { data } = await api.post<ApiResponse<Order>>("/orders", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}

// ─── Exchange order item (SCRUM-21) ─────────────────────────────────────

export interface ExchangeOrderItemPayload {
  id: string; // order id
  orderItemId: string;
  newProductId: string;
  newVariantId?: string;
  quantity?: number;
  notes?: string;
}

export interface ExchangeResult {
  orderId: string;
  difference: number;
  differenceKind: "RECEIVABLE" | "PAYABLE" | "NONE";
  totalAmount: number;
}

export function useExchangeOrderItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: ExchangeOrderItemPayload) => {
      const { data } = await api.post<ApiResponse<ExchangeResult>>(
        `/orders/${id}/exchange`,
        payload
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}

export function useRecentOrders(limit: number = 5) {
  return useQuery({
    queryKey: ["orders", "recent", limit],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<OrderListItem>>(
        "/orders",
        {
          params: { page: 1, limit, sortBy: "createdAt", sortOrder: "desc" },
        }
      );
      return data;
    },
  });
}
