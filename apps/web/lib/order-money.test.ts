import {
  calculateItemTotal,
  calculateOrderTotals,
  maxItemDiscount,
  roundMoney,
  splitInstallments,
} from "@erp/validators";
import { describe, it, expect } from "vitest";

/**
 * Unit tests for `@erp/validators/order-money`, the module the cart and the API
 * share. They live here because this app is the one with a test runner — the
 * package itself has none.
 */
describe("calculateItemTotal", () => {
  it("should multiply quantity by unit price", () => {
    expect(calculateItemTotal({ quantity: 3, unitPrice: 19.9 })).toBe(59.7);
  });

  it("should subtract the discount", () => {
    expect(
      calculateItemTotal({ quantity: 2, unitPrice: 100, discount: 15.5 })
    ).toBe(184.5);
  });

  // VD-10: the cart showed a subtotal of -R$ 320,20 and the API then refused
  // the order because its own clamped total disagreed.
  it("should never go negative when the discount exceeds the line", () => {
    expect(
      calculateItemTotal({ quantity: 1, unitPrice: 50, discount: 500 })
    ).toBe(0);
  });

  it("should round to cents", () => {
    expect(calculateItemTotal({ quantity: 3, unitPrice: 10.333 })).toBe(31);
  });
});

describe("maxItemDiscount", () => {
  it("should cap at the gross line value", () => {
    expect(maxItemDiscount({ quantity: 2, unitPrice: 224.75 })).toBe(449.5);
  });
});

describe("calculateOrderTotals", () => {
  it("should compute subtotal minus discount plus shipping", () => {
    const totals = calculateOrderTotals({
      items: [
        { quantity: 2, unitPrice: 100 },
        { quantity: 1, unitPrice: 50, discount: 5 },
      ],
      discount: 10,
      shippingCost: 15,
    });

    expect(totals).toEqual({
      subtotal: 245,
      discount: 10,
      shippingCost: 15,
      total: 250,
    });
  });

  it("should cap the order discount at the subtotal", () => {
    const totals = calculateOrderTotals({
      items: [{ quantity: 1, unitPrice: 100 }],
      discount: 500,
    });

    expect(totals.discount).toBe(100);
    expect(totals.total).toBe(0);
  });

  it("should treat missing discount and shipping as zero", () => {
    expect(calculateOrderTotals({ items: [{ quantity: 1, unitPrice: 10 }] })).toEqual(
      { subtotal: 10, discount: 0, shippingCost: 0, total: 10 }
    );
  });
});

describe("splitInstallments", () => {
  // VD-05: "3x sem juros" used to generate a single receivable of the full value.
  it("should split R$ 189,80 in 3 as 63.27 / 63.27 / 63.26", () => {
    expect(splitInstallments(189.8, 3)).toEqual([63.27, 63.27, 63.26]);
  });

  it.each([
    [189.8, 3],
    [100, 3],
    [0.05, 4],
    [999.99, 7],
    [1234.56, 12],
  ])("should keep the sum of %s in %sx exact", (amount, count) => {
    const parts = splitInstallments(amount, count);

    expect(parts).toHaveLength(count);
    expect(roundMoney(parts.reduce((a, b) => a + b, 0))).toBe(
      roundMoney(amount)
    );
  });

  it("should return a single installment for counts below one", () => {
    expect(splitInstallments(50, 0)).toEqual([50]);
  });
});
