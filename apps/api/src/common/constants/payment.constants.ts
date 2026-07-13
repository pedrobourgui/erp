import { PaymentMethodType } from '@prisma/client';

/**
 * Payment types whose money lands in the bank account at the moment of the sale.
 * Everything else (boleto, credit card, check…) settles later, through the
 * receivable — so the account is only resolved and credited at settlement.
 */
export const IMMEDIATE_PAYMENT_TYPES: readonly PaymentMethodType[] = [
  'CASH',
  'PIX',
  'DEBIT_CARD',
];

export function isImmediatePayment(type: PaymentMethodType | string): boolean {
  return (IMMEDIATE_PAYMENT_TYPES as readonly string[]).includes(type);
}
