import type { Product, PaginatedResponse, ApiResponse, ProductStatus } from "@erp/shared-types";
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import api from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────────────────

export interface ProductListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  status?: ProductStatus;
  categoryId?: string;
  brandId?: string;
}

export interface ProductFormData {
  name: string;
  sku: string;
  description?: string;
  categoryId?: string;
  brandId?: string;
  costPrice: number;
  salePrice: number;
  promoPrice?: number;
  markup?: number;
  defaultMinStock?: number;
  ncm?: string;
  cest?: string;
  ean?: string;
  /** CFOP com 4 dígitos — sem ele não se emite NF-e de venda (AE-08). */
  cfop?: string;
  weight?: number;
  height?: number;
  width?: number;
  length?: number;
  status: ProductStatus;
}

// ─── Query keys ─────────────────────────────────────────────────────────

export const productKeys = {
  all: ["products"] as const,
  lists: () => [...productKeys.all, "list"] as const,
  list: (params: ProductListParams) => [...productKeys.lists(), params] as const,
  details: () => [...productKeys.all, "detail"] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────

export function useProducts(params: ProductListParams = {}) {
  return useQuery({
    queryKey: productKeys.list(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Product>>("/products", {
        params: {
          page: params.page ?? 1,
          limit: params.limit ?? 20,
          search: params.search || undefined,
          sortBy: params.sortBy || undefined,
          sortOrder: params.sortOrder || undefined,
          status: params.status || undefined,
          categoryId: params.categoryId || undefined,
          brandId: params.brandId || undefined,
        },
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useProduct(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<Product>>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Product>>(`/products/${id}`);
      return data;
    },
    enabled: !!id,
    ...options,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ProductFormData) => {
      const { data } = await api.post<ApiResponse<Product>>("/products", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: ProductFormData & { id: string }) => {
      const { data } = await api.patch<ApiResponse<Product>>(
        `/products/${id}`,
        payload
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: productKeys.detail(variables.id),
      });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
  });
}

// ─── Category types ─────────────────────────────────────────────────

export interface CategoryFormData {
  name: string;
  slug?: string;
  parentId?: string | null;
}

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  parent?: { id: string; name: string } | null;
  _count?: { products: number };
  children?: CategoryRow[];
}

export const categoryKeys = {
  all: ["categories"] as const,
  lists: () => [...categoryKeys.all, "list"] as const,
  details: () => [...categoryKeys.all, "detail"] as const,
  detail: (id: string) => [...categoryKeys.details(), id] as const,
};

// ─── Category hooks ─────────────────────────────────────────────────

export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.lists(),
    queryFn: async () => {
      const { data } = await api.get("/products/categories");
      return data;
    },
  });
}

export function useCategory(id: string) {
  return useQuery({
    queryKey: categoryKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/products/categories/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CategoryFormData) => {
      const { data } = await api.post("/products/categories", dto);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: CategoryFormData & { id: string }) => {
      const { data } = await api.patch(`/products/categories/${id}`, payload);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      queryClient.invalidateQueries({
        queryKey: categoryKeys.detail(variables.id),
      });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/products/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

// ─── Brand types ────────────────────────────────────────────────────

export interface BrandFormData {
  name: string;
  logoUrl?: string;
}

export interface BrandRow {
  id: string;
  name: string;
  logoUrl?: string | null;
  _count?: { products: number };
}

export interface BrandListParams {
  search?: string;
}

export const brandKeys = {
  all: ["brands"] as const,
  lists: () => [...brandKeys.all, "list"] as const,
  list: (params: BrandListParams) => [...brandKeys.lists(), params] as const,
  details: () => [...brandKeys.all, "detail"] as const,
  detail: (id: string) => [...brandKeys.details(), id] as const,
};

// ─── Brand hooks ────────────────────────────────────────────────────

export function useBrands(params: BrandListParams = {}) {
  return useQuery({
    queryKey: brandKeys.list(params),
    queryFn: async () => {
      const { data } = await api.get("/products/brands", {
        params: {
          search: params.search || undefined,
        },
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useBrand(id: string) {
  return useQuery({
    queryKey: brandKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/products/brands/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: BrandFormData) => {
      const { data } = await api.post("/products/brands", dto);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brandKeys.all });
    },
  });
}

export function useUpdateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: BrandFormData & { id: string }) => {
      const { data } = await api.patch(`/products/brands/${id}`, payload);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: brandKeys.all });
      queryClient.invalidateQueries({
        queryKey: brandKeys.detail(variables.id),
      });
    },
  });
}

export function useDeleteBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/products/brands/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brandKeys.all });
    },
  });
}

// useBulkUpdateProducts - commented out: /products/bulk endpoint does not exist in backend
// export function useBulkUpdateProducts() {
//   const queryClient = useQueryClient();
//
//   return useMutation({
//     mutationFn: async ({
//       ids,
//       action,
//     }: {
//       ids: string[];
//       action: "activate" | "deactivate" | "delete";
//     }) => {
//       const { data } = await api.post("/products/bulk", { ids, action });
//       return data;
//     },
//     onSuccess: () => {
//       queryClient.invalidateQueries({ queryKey: productKeys.lists() });
//     },
//   });
// }
