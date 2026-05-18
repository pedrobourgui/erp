/**
 * Factories for building Order and OrderItem test data.
 */
export interface FactoryOrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId: string | null;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  totalPrice: number;
}

export interface FactoryOrder {
  id: string;
  tenantId: string;
  orderNumber: string;
  status: string;
  origin: string;
  customerId: string;
  sellerId: string;
  subtotal: number;
  discount: number;
  shippingCost: number;
  totalAmount: number;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items: FactoryOrderItem[];
  customer: { id: string; name: string };
  statusHistory: Array<{
    id: string;
    orderId: string;
    fromStatus: string | null;
    toStatus: string;
    notes: string;
    changedBy: string;
    createdAt: Date;
  }>;
}

let orderSeq = 0;
let orderItemSeq = 0;

export function buildOrderItem(overrides: Partial<FactoryOrderItem> = {}): FactoryOrderItem {
  orderItemSeq++;
  const seq = String(orderItemSeq).padStart(3, '0');

  const quantity = overrides.quantity ?? 2;
  const unitPrice = overrides.unitPrice ?? 49.9;
  const discount = overrides.discount ?? 0;

  return {
    id: `item-uuid-${seq}`,
    orderId: 'order-uuid-001',
    productId: `prod-uuid-${seq}`,
    variantId: null,
    sku: `SKU-${seq}`,
    name: `Produto ${seq}`,
    quantity,
    unitPrice,
    discount,
    totalPrice: Math.max(quantity * unitPrice - discount, 0),
    ...overrides,
  };
}

export function buildOrder(overrides: Partial<FactoryOrder> = {}): FactoryOrder {
  orderSeq++;
  const seq = String(orderSeq).padStart(6, '0');
  const orderId = overrides.id ?? `order-uuid-${seq}`;

  const items = overrides.items ?? [buildOrderItem({ orderId })];
  const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0);
  const disc = overrides.discount ?? 0;
  const shipping = overrides.shippingCost ?? 15;

  return {
    id: orderId,
    tenantId: 'tenant-uuid-001',
    orderNumber: `PED-${seq}`,
    status: 'PENDING',
    origin: 'MANUAL',
    customerId: 'cust-uuid-001',
    sellerId: 'user-uuid-001',
    subtotal,
    discount: disc,
    shippingCost: shipping,
    totalAmount: subtotal - disc + shipping,
    shippedAt: null,
    deliveredAt: null,
    cancelledAt: null,
    cancelReason: null,
    deletedAt: null,
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
    items,
    customer: { id: 'cust-uuid-001', name: 'Joao da Silva' },
    statusHistory: [
      {
        id: `hist-uuid-${seq}`,
        orderId,
        fromStatus: null,
        toStatus: 'PENDING',
        notes: 'Order created',
        changedBy: 'user-uuid-001',
        createdAt: new Date('2026-03-01'),
      },
    ],
    ...overrides,
  };
}

export function resetOrderSeq(): void {
  orderSeq = 0;
  orderItemSeq = 0;
}
