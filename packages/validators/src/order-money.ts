/**
 * The money arithmetic of an order, shared by the API and the web app.
 *
 * VD-10 happened because each side had its own version: the cart allowed a
 * discount larger than the item and displayed a negative subtotal, while the
 * API clamped the item at zero and then refused to save the order because the
 * totals disagreed. Both sides now call these functions.
 */

/** Rounds to cents, the only precision the database stores. */
export function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export interface OrderItemAmounts {
  quantity: number;
  unitPrice: number;
  discount?: number;
}

/**
 * Line total, never negative — a discount bigger than the line is capped at the
 * line value, exactly like the API stores it.
 */
export function calculateItemTotal(item: OrderItemAmounts): number {
  const gross = roundMoney((item.quantity || 0) * (item.unitPrice || 0));
  const discount = roundMoney(item.discount ?? 0);
  return roundMoney(Math.max(gross - discount, 0));
}

/** Largest discount a line accepts before the total would go negative. */
export function maxItemDiscount(item: OrderItemAmounts): number {
  return roundMoney((item.quantity || 0) * (item.unitPrice || 0));
}

export interface OrderAmounts {
  items: OrderItemAmounts[];
  /** Order-level discount, applied on top of the per-item ones. */
  discount?: number;
  shippingCost?: number;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
}

export function calculateOrderTotals(order: OrderAmounts): OrderTotals {
  const subtotal = roundMoney(
    order.items.reduce((sum, item) => sum + calculateItemTotal(item), 0),
  );
  const discount = Math.min(roundMoney(order.discount ?? 0), subtotal);
  const shippingCost = roundMoney(order.shippingCost ?? 0);

  return {
    subtotal,
    discount,
    shippingCost,
    total: roundMoney(subtotal - discount + shippingCost),
  };
}

/**
 * Splits an amount into `count` installments whose sum is exactly the amount.
 * The leftover cents land on the last installment, so R$ 189,80 in 3x becomes
 * 63,27 / 63,27 / 63,26.
 */
export function splitInstallments(amount: number, count: number): number[] {
  const total = roundMoney(amount);
  const installments = Math.max(Math.trunc(count) || 1, 1);

  const base = roundMoney(total / installments);
  const values = Array.from({ length: installments }, () => base);
  values[installments - 1] = roundMoney(total - base * (installments - 1));

  return values;
}
