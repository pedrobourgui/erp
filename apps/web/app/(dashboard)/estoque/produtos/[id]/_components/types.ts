import type { Product } from "@erp/shared-types";

// ─── Detail-endpoint shape ──────────────────────────────────────────────
// GET /products/:id returns the full Product graph (variants, images,
// inventory + warehouse) plus an aggregated inventorySummary. The shared
// `Product` type only covers the flat columns, so we extend it here for the
// detail page (SCRUM-20).

export type ProductVariantDetail = {
  id: string;
  sku: string;
  name: string;
  ean?: string | null;
  costPrice?: number | null;
  salePrice?: number | null;
  attributes?: Record<string, string | number> | null;
  isActive: boolean;
  inventoryItems: Array<{
    id: string;
    warehouseId: string;
    quantity: number;
    reserved: number;
    available: number;
  }>;
};

export type ProductImageDetail = {
  id: string;
  url: string;
  key: string;
  position: number;
  isMain: boolean;
};

export type ProductInventoryDetail = {
  id: string;
  variantId?: string | null;
  quantity: number;
  reserved: number;
  available: number;
  minStock: number;
  maxStock?: number | null;
  costAverage: number;
  warehouse: { id: string; name: string; code: string };
};

export type ProductDetail = Omit<Product, "brand"> & {
  category?: { id: string; name: string; slug: string } | null;
  brand?: { id: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
  variants: ProductVariantDetail[];
  images: ProductImageDetail[];
  inventoryItems: ProductInventoryDetail[];
  inventorySummary: {
    totalQuantity: number;
    totalReserved: number;
    totalAvailable: number;
  };
};
