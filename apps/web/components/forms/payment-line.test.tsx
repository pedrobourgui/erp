import { describe, it, expect } from 'vitest';

import type { PaymentMethod } from '@/hooks/use-payment-methods';

import { requiresLinkedAccount, hasMissingAccount } from './payment-line';

function makeMethod(overrides: Partial<PaymentMethod> = {}): PaymentMethod {
  return {
    id: 'pm-1',
    name: 'Dinheiro',
    type: 'CASH',
    defaultAccountId: 'acc-1',
    feePercentage: 0,
    settlementDays: 0,
    requiresAuthorization: false,
    fiscalCode: null,
    isActive: true,
    ...overrides,
  };
}

describe('requiresLinkedAccount', () => {
  it.each(['CASH', 'PIX', 'DEBIT_CARD'] as const)(
    'should require an account for the immediate type %s',
    (type) => {
      expect(requiresLinkedAccount(type)).toBe(true);
    }
  );

  it.each(['CREDIT_CARD', 'BOLETO', 'BANK_TRANSFER', 'CHECK', 'STORE_CREDIT', 'OTHER'] as const)(
    'should NOT require an account for the term type %s',
    (type) => {
      expect(requiresLinkedAccount(type)).toBe(false);
    }
  );

  it('should not require an account when no method is selected', () => {
    expect(requiresLinkedAccount(null)).toBe(false);
  });
});

describe('hasMissingAccount', () => {
  const methods = [
    makeMethod({ id: 'pm-cash', type: 'CASH', defaultAccountId: null }),
    makeMethod({ id: 'pm-pix', type: 'PIX', defaultAccountId: 'acc-1' }),
    makeMethod({ id: 'pm-boleto', type: 'BOLETO', defaultAccountId: null }),
  ];

  it('should flag an immediate method with no linked account', () => {
    expect(
      hasMissingAccount([{ paymentMethodId: 'pm-cash' }], methods)
    ).toBe(true);
  });

  it('should accept an immediate method with a linked account', () => {
    expect(
      hasMissingAccount([{ paymentMethodId: 'pm-pix' }], methods)
    ).toBe(false);
  });

  it('should accept an immediate method whose account was chosen on the line', () => {
    expect(
      hasMissingAccount(
        [{ paymentMethodId: 'pm-cash', financialAccountId: 'acc-2' }],
        methods
      )
    ).toBe(false);
  });

  it('should NOT flag a term method without an account (it settles later)', () => {
    expect(
      hasMissingAccount([{ paymentMethodId: 'pm-boleto' }], methods)
    ).toBe(false);
  });

  it('should flag when any line among several is missing its account', () => {
    expect(
      hasMissingAccount(
        [{ paymentMethodId: 'pm-pix' }, { paymentMethodId: 'pm-cash' }],
        methods
      )
    ).toBe(true);
  });

  it('should ignore an empty line with no method selected', () => {
    expect(hasMissingAccount([{ paymentMethodId: '' }], methods)).toBe(false);
  });

  it('should handle an undefined payments list', () => {
    expect(hasMissingAccount(undefined, methods)).toBe(false);
  });
});
