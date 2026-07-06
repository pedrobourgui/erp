import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import api from "@/lib/api";
import type { PaginatedResponse, ApiResponse, InventoryItem } from "@erp/shared-types";

// ─── Types ──────────────────────────────────────────────────────────────

export type MovementType = "ENTRY" | "EXIT" | "ADJUSTMENT" | "TRANSFER";

export type MovementReason =
  | "PURCHASE"
  | "SALE"
  | "TRANSFER"
  | "ADJUSTMENT"
  | "RETURN_CUSTOMER"
  | "RETURN_SUPPLIER"
  | "DAMAGE"
  | "THEFT"
  | "PRODUCTION"
  | "INITIAL"
  | "COUNT";

export type AlertStatus = "ACTIVE" | "RESOLVED";

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  warehouseId: string;
  warehouseName: string;
  type: MovementType;
  reason: MovementReason;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  userId: string;
  userName: string;
  notes?: string;
  createdAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  isDefault: boolean;
  productCount: number;
  createdAt: string;
}

export interface StockAlert {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  warehouseId: string;
  warehouseName: string;
  currentStock: number;
  minStock: number;
  status: AlertStatus;
  createdAt: string;
  resolvedAt?: string;
}

export interface MovementListParams {
  page?: number;
  limit?: number;
  type?: MovementType;
  reason?: MovementReason;
  productId?: string;
  warehouseId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface AlertListParams {
  page?: number;
  limit?: number;
  status?: AlertStatus;
}

export interface CreateMovementPayload {
  productId: string;
  /** Required for ENTRY movements (destination). */
  toWarehouseId?: string;
  /** Required for EXIT movements (source). */
  fromWarehouseId?: string;
  type: MovementType;
  reason: MovementReason;
  quantity: number;
  unitCost?: number;
  notes?: string;
}

export interface CreateWarehousePayload {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  isDefault?: boolean;
}

// ─── Query keys ─────────────────────────────────────────────────────────

export const inventoryKeys = {
  all: ["inventory"] as const,
  items: (params: Record<string, unknown>) => [...inventoryKeys.all, "items", params] as const,
  movements: (params: MovementListParams) => [...inventoryKeys.all, "movements", params] as const,
  warehouses: () => [...inventoryKeys.all, "warehouses"] as const,
  alerts: (params: AlertListParams) => [...inventoryKeys.all, "alerts", params] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────

export function useInventoryItems(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: inventoryKeys.items(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<InventoryItem>>("/inventory", { params });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useStockMovements(params: MovementListParams = {}) {
  return useQuery({
    queryKey: inventoryKeys.movements(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<StockMovement>>("/inventory/movements", {
        params: {
          page: params.page ?? 1,
          limit: params.limit ?? 20,
          type: params.type || undefined,
          productId: params.productId || undefined,
          warehouseId: params.warehouseId || undefined,
          dateFrom: params.dateFrom || undefined,
          dateTo: params.dateTo || undefined,
        },
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useWarehouses() {
  return useQuery({
    queryKey: inventoryKeys.warehouses(),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Warehouse[]>>("/inventory/warehouses");
      return data;
    },
  });
}

export function useStockAlerts(params: AlertListParams = {}) {
  return useQuery({
    queryKey: inventoryKeys.alerts(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<StockAlert>>("/inventory/alerts", { params });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useCreateMovement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateMovementPayload) => {
      const { data } = await api.post<ApiResponse<StockMovement>>(
        "/inventory/movement",
        payload
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

export function useSetMinStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, minStock }: { itemId: string; minStock: number }) => {
      const { data } = await api.patch<ApiResponse<InventoryItem>>(
        `/inventory/items/${itemId}/min-stock`,
        { minStock }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateWarehousePayload) => {
      const { data } = await api.post<ApiResponse<Warehouse>>(
        "/inventory/warehouses",
        payload
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.warehouses() });
    },
  });
}
