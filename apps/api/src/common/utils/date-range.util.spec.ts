import {
  civilDaysFrom,
  civilInstallmentDueDates,
  parseUserDate,
  DEFAULT_TENANT_TIMEZONE,
  endOfDayInTz,
  shiftDateKey,
  startOfDayInTz,
  toDateRange,
  toLocalDateKey,
} from './date-range.util';

/**
 * FN-01 / VD-09: filters used to parse 'YYYY-MM-DD' as UTC and then call
 * `setHours`, which applies the *process* timezone. In BRT the end of the
 * period landed ~21h early and the last day of the range was mostly dropped.
 *
 * These tests state the contract in absolute instants, so they hold no matter
 * which TZ the suite runs under.
 */
describe('date-range.util', () => {
  const SP = 'America/Sao_Paulo';
  const TOKYO = 'Asia/Tokyo';

  describe('startOfDayInTz', () => {
    it('should return midnight in São Paulo as an UTC instant', () => {
      // 2026-07-31 00:00 in -03 is 03:00 UTC
      expect(startOfDayInTz('2026-07-31', SP).toISOString()).toBe(
        '2026-07-31T03:00:00.000Z',
      );
    });

    it('should return midnight in Tokyo as an UTC instant', () => {
      // 2026-07-31 00:00 in +09 is 15:00 UTC of the previous day
      expect(startOfDayInTz('2026-07-31', TOKYO).toISOString()).toBe(
        '2026-07-30T15:00:00.000Z',
      );
    });

    it('should be the identity in UTC', () => {
      expect(startOfDayInTz('2026-07-31', 'UTC').toISOString()).toBe(
        '2026-07-31T00:00:00.000Z',
      );
    });

    it('should default to the tenant timezone', () => {
      expect(startOfDayInTz('2026-07-31').toISOString()).toBe(
        startOfDayInTz('2026-07-31', DEFAULT_TENANT_TIMEZONE).toISOString(),
      );
    });

    it('should accept a full ISO string and use only its date part', () => {
      expect(startOfDayInTz('2026-07-31T18:45:00.000Z', SP).toISOString()).toBe(
        '2026-07-31T03:00:00.000Z',
      );
    });
  });

  describe('endOfDayInTz', () => {
    it('should return the last millisecond of the day in São Paulo', () => {
      expect(endOfDayInTz('2026-07-31', SP).toISOString()).toBe(
        '2026-08-01T02:59:59.999Z',
      );
    });

    it('should return the last millisecond of the day in Tokyo', () => {
      expect(endOfDayInTz('2026-07-31', TOKYO).toISOString()).toBe(
        '2026-07-31T14:59:59.999Z',
      );
    });

    // The bug in one line: a sale at 23:50 BRT belongs to that same day.
    it('should include a record created at 23:50 local time', () => {
      const lateSale = new Date('2026-08-01T02:50:00.000Z'); // 23:50 of 31/07 in -03
      const end = endOfDayInTz('2026-07-31', SP);

      expect(lateSale.getTime()).toBeLessThanOrEqual(end.getTime());
    });

    it('should not include the first instant of the next day', () => {
      const nextDay = new Date('2026-08-01T03:00:00.000Z'); // 00:00 of 01/08 in -03

      expect(nextDay.getTime()).toBeGreaterThan(endOfDayInTz('2026-07-31', SP).getTime());
    });
  });

  describe('daylight saving', () => {
    // Tokyo has no DST; New York does. The helper must ask the zone, never assume.
    it('should use the offset in force on the date, not today', () => {
      const winter = startOfDayInTz('2026-01-15', 'America/New_York'); // -05
      const summer = startOfDayInTz('2026-07-15', 'America/New_York'); // -04

      expect(winter.toISOString()).toBe('2026-01-15T05:00:00.000Z');
      expect(summer.toISOString()).toBe('2026-07-15T04:00:00.000Z');
    });
  });

  describe('toDateRange', () => {
    it('should build a full-day range from a single date', () => {
      expect(toDateRange('2026-07-31', '2026-07-31', SP)).toEqual({
        gte: new Date('2026-07-31T03:00:00.000Z'),
        lte: new Date('2026-08-01T02:59:59.999Z'),
      });
    });

    it('should accept an open start', () => {
      expect(toDateRange(undefined, '2026-07-31', SP)).toEqual({
        lte: new Date('2026-08-01T02:59:59.999Z'),
      });
    });

    it('should accept an open end', () => {
      expect(toDateRange('2026-07-01', undefined, SP)).toEqual({
        gte: new Date('2026-07-01T03:00:00.000Z'),
      });
    });

    it('should return undefined when no bound is given', () => {
      expect(toDateRange(undefined, undefined, SP)).toBeUndefined();
    });

    // FN-23: defensive — the UI warns first, but an inverted range must not
    // silently return an empty list.
    it('should swap an inverted range', () => {
      expect(toDateRange('2026-12-31', '2026-01-01', SP)).toEqual(
        toDateRange('2026-01-01', '2026-12-31', SP),
      );
    });

    it('should ignore an unparseable date', () => {
      expect(toDateRange('not-a-date', '2026-07-31', SP)).toEqual({
        lte: new Date('2026-08-01T02:59:59.999Z'),
      });
    });
  });

  describe('shiftDateKey', () => {
    it('should walk forward and backward', () => {
      expect(shiftDateKey('2026-07-31', 1)).toBe('2026-08-01');
      expect(shiftDateKey('2026-08-01', -1)).toBe('2026-07-31');
      expect(shiftDateKey('2026-07-31', 0)).toBe('2026-07-31');
    });

    it('should cross month and year boundaries', () => {
      expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01');
      expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
    });

    // A 24h step over a DST change lands on the wrong civil day; this must not.
    it('should stay on calendar days across a DST change', () => {
      expect(shiftDateKey('2026-10-31', 1)).toBe('2026-11-01');
      expect(shiftDateKey('2026-02-14', 14)).toBe('2026-02-28');
    });
  });

  describe('parseUserDate', () => {
    it('should read a bare YYYY-MM-DD as a civil date', () => {
      expect(parseUserDate('2026-01-15', SP).toISOString()).toBe(
        '2026-01-15T03:00:00.000Z',
      );
    });

    it('should keep an instant with a time as it is', () => {
      expect(parseUserDate('2026-01-15T18:45:00.000Z', SP).toISOString()).toBe(
        '2026-01-15T18:45:00.000Z',
      );
    });
  });

  describe('civilInstallmentDueDates', () => {
    it('should place every installment on midnight of its civil day', () => {
      const sale = new Date('2026-08-01T02:50:00.000Z'); // 23:50 of 31/07 in -03

      const dates = civilInstallmentDueDates(sale, 3, 30, SP);

      expect(dates.map((d) => toLocalDateKey(d, SP))).toEqual([
        '2026-08-30',
        '2026-09-29',
        '2026-10-29',
      ]);
    });
  });

  describe('civilDaysFrom', () => {
    it('should land on midnight of the tenant day, not on the same time of day', () => {
      const sale = new Date('2026-08-01T02:50:00.000Z'); // 23:50 of 31/07 in -03

      expect(civilDaysFrom(sale, 30, SP).toISOString()).toBe(
        '2026-08-30T03:00:00.000Z', // 30/08 00:00 in -03
      );
    });

    it('should count from the tenant day of the instant', () => {
      // The same instant is already 01/08 in UTC, so a UTC-based count would
      // produce 31/08 and the receivable would show the wrong day.
      const sale = new Date('2026-08-01T02:50:00.000Z');

      expect(toLocalDateKey(civilDaysFrom(sale, 30, SP), SP)).toBe('2026-08-30');
    });

    it('should return the same civil day for zero days', () => {
      const sale = new Date('2026-08-01T02:50:00.000Z');

      expect(toLocalDateKey(civilDaysFrom(sale, 0, SP), SP)).toBe('2026-07-31');
    });
  });

  describe('toLocalDateKey', () => {
    it('should key an instant by the civil day of the tenant', () => {
      // 23:50 of 31/07 in -03 is already 01/08 in UTC
      expect(toLocalDateKey(new Date('2026-08-01T02:50:00.000Z'), SP)).toBe(
        '2026-07-31',
      );
    });

    it('should agree with UTC when the tenant is in UTC', () => {
      expect(toLocalDateKey(new Date('2026-08-01T02:50:00.000Z'), 'UTC')).toBe(
        '2026-08-01',
      );
    });
  });
});
