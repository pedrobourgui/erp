// ─── Enums (union types) ───────────────────────────────────────────────

export type OrderStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'CONFIRMED'
  | 'PICKING'
  | 'PACKED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'RETURNED';

export type ProductStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'DRAFT';

export type OrderOrigin =
  | 'MANUAL'
  | 'BALCAO'
  | 'MERCADO_LIVRE'
  | 'SHOPEE'
  | 'AMAZON'
  | 'MAGALU'
  | 'SHOPIFY'
  | 'NUVEMSHOP'
  | 'WOOCOMMERCE'
  | 'API';

export type MarketplaceType =
  | 'MERCADO_LIVRE'
  | 'SHOPEE'
  | 'AMAZON'
  | 'MAGALU'
  | 'SHOPIFY'
  | 'NUVEMSHOP';

// ─── Core entities ─────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  role: string;
}

export type ProductType = 'SIMPLE' | 'VARIABLE' | 'KIT' | 'SERVICE';

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  type?: ProductType;
  costPrice: number;
  salePrice: number;
  promoPrice?: number;
  markup?: number;
  status: ProductStatus;
  categoryId?: string;
  brandId?: string;
  brand?: string;
  ncm?: string;
  cest?: string;
  ean?: string;
  weight?: number;
  height?: number;
  width?: number;
  length?: number;
  /** Minimum that seeds each InventoryItem created for this product (SCRUM-37). */
  defaultMinStock?: number;
  minStock?: number;
  maxStock?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  origin: OrderOrigin;
  totalAmount: number;
  customerId?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  document: string;
}

export interface InventoryItem {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  reserved: number;
  available: number;
}

// ─── API response types ────────────────────────────────────────────────

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: PaginationMeta;
}

// ─── Auth types ────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;
  tenantId: string;
  roleId: string;
  email: string;
}
