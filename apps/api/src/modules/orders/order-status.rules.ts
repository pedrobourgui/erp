import { BadRequestException } from '@nestjs/common';

/**
 * Statuses in which an order is closed for business: no item, payment or
 * shipping change may be applied to it.
 *
 * Regression VD-03: an item exchange executed on a CANCELLED order created
 * phantom stock (RETURN of goods that never left), consumed real stock of the
 * replacement product and issued a refund obligation.
 */
export const IMMUTABLE_ORDER_STATUSES = [
  'CANCELLED',
  'RETURNED',
  'COMPLETED',
] as const;

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  PICKING: 'Separando',
  PACKED: 'Embalado',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregue',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  RETURNED: 'Devolvido',
};

export function translateOrderStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function isOrderMutable(status: string): boolean {
  return !IMMUTABLE_ORDER_STATUSES.includes(
    status as (typeof IMMUTABLE_ORDER_STATUSES)[number],
  );
}

/**
 * Guards every operation that changes the contents of an order.
 * Call it right after loading the order, before touching stock or financials.
 */
export function assertOrderMutable(
  order: { status: string; orderNumber?: string },
  operation = 'alterar o pedido',
): void {
  if (isOrderMutable(order.status)) return;

  const reference = order.orderNumber ? ` ${order.orderNumber}` : '';
  throw new BadRequestException(
    `Não é possível ${operation}${reference}: ele está ${translateOrderStatus(
      order.status,
    ).toLowerCase()}.`,
  );
}
