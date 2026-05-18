/**
 * Typed event definitions for the application event bus.
 */

// ─── Order Events ────────────────────────────────────────────────────────

export class OrderCreatedEvent {
  readonly eventName = 'order.created' as const;

  constructor(
    public readonly orderId: string,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly items: Array<{
      productId: string;
      variantId?: string | null;
      quantity: number;
      unitPrice: unknown;
      totalPrice: unknown;
    }>,
  ) {}
}

export class OrderConfirmedEvent {
  readonly eventName = 'order.confirmed' as const;

  constructor(
    public readonly orderId: string,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly totalAmount: number,
    public readonly items: Array<{
      productId: string;
      variantId?: string | null;
      quantity: number;
    }>,
  ) {}
}

export class OrderShippedEvent {
  readonly eventName = 'order.shipped' as const;

  constructor(
    public readonly orderId: string,
    public readonly tenantId: string,
  ) {}
}

export class OrderCancelledEvent {
  readonly eventName = 'order.cancelled' as const;

  constructor(
    public readonly orderId: string,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly items: Array<{
      productId: string;
      variantId?: string | null;
      quantity: number;
    }>,
    public readonly reason: string,
    public readonly previousStatus?: string,
  ) {}
}

export class OrderDeliveredEvent {
  readonly eventName = 'order.delivered' as const;

  constructor(
    public readonly orderId: string,
    public readonly tenantId: string,
  ) {}
}

export class OrderCounterSaleEvent {
  readonly eventName = 'order.counter_sale' as const;

  constructor(
    public readonly orderId: string,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly totalAmount: number,
    public readonly items: Array<{
      productId: string;
      variantId?: string | null;
      quantity: number;
    }>,
  ) {}
}

// ─── Stock Events ────────────────────────────────────────────────────────

export class StockLowEvent {
  readonly eventName = 'stock.low' as const;

  constructor(
    public readonly tenantId: string,
    public readonly productId: string,
    public readonly variantId: string | null,
    public readonly warehouseId: string,
    public readonly currentQty: number,
    public readonly minStock: number,
  ) {}
}

// ─── Product Events ──────────────────────────────────────────────────────

export class ProductUpdatedEvent {
  readonly eventName = 'product.updated' as const;

  constructor(
    public readonly productId: string,
    public readonly tenantId: string,
    public readonly changes: Record<string, unknown>,
  ) {}
}

// ─── Event Type Map ──────────────────────────────────────────────────────

export type AppEvent =
  | OrderCreatedEvent
  | OrderConfirmedEvent
  | OrderShippedEvent
  | OrderDeliveredEvent
  | OrderCancelledEvent
  | OrderCounterSaleEvent
  | StockLowEvent
  | ProductUpdatedEvent;

export const EVENT_NAMES = {
  ORDER_CREATED: 'order.created',
  ORDER_CONFIRMED: 'order.confirmed',
  ORDER_SHIPPED: 'order.shipped',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_COUNTER_SALE: 'order.counter_sale',
  STOCK_LOW: 'stock.low',
  PRODUCT_UPDATED: 'product.updated',
} as const;
