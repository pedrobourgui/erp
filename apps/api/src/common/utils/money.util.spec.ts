import { Prisma } from '@prisma/client';
import { toMoney, sumMoney, subtractMoney, toCents } from './money.util';

/**
 * FN-28: `GET /financial-entries` answered `"balance": 708.9000000000001`.
 *
 * The cause is the usual one: `Number(Decimal)` produces binary floats and
 * adding them accumulates error. The database stores cents; so should every sum
 * that crosses the API boundary.
 */
describe('money helpers', () => {
  describe('toCents', () => {
    it('converts reais to integer cents', () => {
      expect(toCents(708.9)).toBe(70890);
      expect(toCents('149.90')).toBe(14990);
      expect(toCents(new Prisma.Decimal('0.07'))).toBe(7);
    });

    it('treats null, undefined and garbage as zero', () => {
      expect(toCents(null)).toBe(0);
      expect(toCents(undefined)).toBe(0);
      expect(toCents(Number.NaN)).toBe(0);
    });

    it('rounds a third cent instead of truncating it', () => {
      expect(toCents(0.005)).toBe(1);
      expect(toCents(0.004)).toBe(0);
      expect(toCents(-0.005)).toBe(-1);
    });
  });

  describe('sumMoney', () => {
    it('reproduces the FN-28 case without noise', () => {
      // The exact value the API leaked: 299.8 + 409.1 is 708.9000000000001 in
      // binary floating point.
      expect(299.8 + 409.1).not.toBe(708.9);
      expect(sumMoney([299.8, 409.1])).toBe(708.9);
      expect(sumMoney([149.9, 149.9, 409.1])).toBe(708.9);
    });

    it('adds Prisma decimals, strings and numbers alike', () => {
      expect(
        sumMoney([new Prisma.Decimal('10.10'), '20.20', 30.3, null, undefined]),
      ).toBe(60.6);
    });

    it('is zero for an empty list', () => {
      expect(sumMoney([])).toBe(0);
    });

    it('survives a long series of thirds', () => {
      const values = Array.from({ length: 300 }, () => 0.1);
      expect(sumMoney(values)).toBe(30);
    });
  });

  describe('subtractMoney', () => {
    it('subtracts without residue', () => {
      expect(subtractMoney(0.3, 0.1)).toBe(0.2);
      expect(0.3 - 0.1).not.toBe(0.2);
    });

    it('keeps negative results', () => {
      expect(subtractMoney(100, 250.5)).toBe(-150.5);
    });
  });

  describe('toMoney', () => {
    it('normalises a decimal to a two-place number', () => {
      expect(toMoney(new Prisma.Decimal('708.900000'))).toBe(708.9);
      expect(toMoney('12.345')).toBe(12.35);
      expect(toMoney(null)).toBe(0);
    });

    it('never returns a value with more than two decimals', () => {
      for (const value of [1 / 3, 2 / 3, 0.1 + 0.2, 708.9000000000001]) {
        const result = toMoney(value);
        expect(Number(result.toFixed(2))).toBe(result);
      }
    });
  });
});
