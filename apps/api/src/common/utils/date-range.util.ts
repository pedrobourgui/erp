/**
 * Civil dates versus instants.
 *
 * A filter like `?startDate=2026-07-31` is a *civil date*: the day as the user
 * reads it on the wall calendar, in the tenant's timezone. An `createdAt` is an
 * *instant*: a point in time, stored in UTC. Converting between them is what
 * FN-01 and VD-09 got wrong — `new Date('2026-07-31')` parses as UTC midnight
 * and `setHours` then applies the *process* timezone, so in UTC-3 the end of
 * the period landed at 02:59 UTC and swallowed ~21h of the last day.
 *
 * Everything here is built on `Intl`, which knows the real offset in force on
 * each date (including daylight saving). Never use `setHours` for this.
 *
 * TODO(lote 5): the timezone should come from the tenant's settings; until that
 * field exists, every caller gets DEFAULT_TENANT_TIMEZONE.
 */
export const DEFAULT_TENANT_TIMEZONE = 'America/Sao_Paulo';

export interface DateRange {
  gte?: Date;
  lte?: Date;
}

const DATE_PART = /^(\d{4})-(\d{2})-(\d{2})/;

/** Offset of `timeZone` at a given instant, in milliseconds (east is positive). */
function offsetAt(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');

  const asIfUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
    instant.getUTCMilliseconds(),
  );

  return asIfUtc - instant.getTime();
}

/** The instant at which the given wall-clock time happens in `timeZone`. */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string,
): Date {
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);

  // First guess with the offset around that wall clock, then re-read the offset
  // at the resulting instant — the second pass is what gets DST changes right.
  const firstGuess = wallClock - offsetAt(new Date(wallClock), timeZone);
  const offset = offsetAt(new Date(firstGuess), timeZone);

  return new Date(wallClock - offset);
}

function parseDateParts(value: string): [number, number, number] | null {
  const match = DATE_PART.exec(value.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Start of the civil day (00:00:00.000 local) as an UTC instant.
 * Accepts `YYYY-MM-DD` or any ISO string — only the date part is used.
 */
export function startOfDayInTz(
  date: string,
  timeZone: string = DEFAULT_TENANT_TIMEZONE,
): Date {
  const parts = parseDateParts(date);
  if (!parts) throw new RangeError(`Invalid date: ${date}`);
  const [year, month, day] = parts;
  return zonedTimeToUtc(year, month, day, 0, 0, 0, 0, timeZone);
}

/** End of the civil day (23:59:59.999 local) as an UTC instant. */
export function endOfDayInTz(
  date: string,
  timeZone: string = DEFAULT_TENANT_TIMEZONE,
): Date {
  const parts = parseDateParts(date);
  if (!parts) throw new RangeError(`Invalid date: ${date}`);
  const [year, month, day] = parts;
  return zonedTimeToUtc(year, month, day, 23, 59, 59, 999, timeZone);
}

/**
 * Prisma-ready `{ gte, lte }` covering whole civil days in the tenant timezone.
 * Unparseable bounds are dropped and an inverted range is swapped (FN-23) — the
 * UI warns first, but an inverted range must never look like "no results".
 */
export function toDateRange(
  from?: string,
  to?: string,
  timeZone: string = DEFAULT_TENANT_TIMEZONE,
): DateRange | undefined {
  let start = from && parseDateParts(from) ? from : undefined;
  let end = to && parseDateParts(to) ? to : undefined;

  if (start && end && startOfDayInTz(start, timeZone) > startOfDayInTz(end, timeZone)) {
    [start, end] = [end, start];
  }

  const range: DateRange = {};
  if (start) range.gte = startOfDayInTz(start, timeZone);
  if (end) range.lte = endOfDayInTz(end, timeZone);

  return Object.keys(range).length ? range : undefined;
}

/**
 * Adds days to a `YYYY-MM-DD` key using pure calendar arithmetic.
 *
 * Walking a series with `+ 24 * 60 * 60 * 1000` skips or repeats a day whenever
 * a daylight-saving change falls inside the window; civil days are always one
 * day apart, whatever the clocks do.
 */
export function shiftDateKey(dateKey: string, days: number): string {
  const parts = parseDateParts(dateKey);
  if (!parts) throw new RangeError(`Invalid date: ${dateKey}`);
  const [year, month, day] = parts;

  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/**
 * A due date `days` calendar days after `from`, at midnight in the tenant
 * timezone.
 *
 * `new Date(now.getTime() + 30 * DAY_MS)` keeps the time of day, so a sale at
 * 23:50 produces a due date at 23:50 — which, read as a civil date, is already
 * the following day for any negative offset. Due dates are civil dates: they
 * must land on midnight of the tenant's day.
 */
export function civilDaysFrom(
  from: Date,
  days: number,
  timeZone: string = DEFAULT_TENANT_TIMEZONE,
): Date {
  const key = shiftDateKey(toLocalDateKey(from, timeZone), days);
  return startOfDayInTz(key, timeZone);
}

/**
 * Parses a date coming from a client.
 *
 * A bare `YYYY-MM-DD` is a civil date — what an `<input type="date">` submits —
 * and lands on midnight in the tenant timezone. Anything carrying a time is an
 * instant and is kept as it is.
 */
export function parseUserDate(
  value: string,
  timeZone: string = DEFAULT_TENANT_TIMEZONE,
): Date {
  const isCivilDate = /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
  return isCivilDate ? startOfDayInTz(value, timeZone) : new Date(value);
}

/**
 * Due date of each installment: `daysBetween` calendar days apart, all at
 * midnight in the tenant timezone (VD-05 + FN-02 together).
 */
export function civilInstallmentDueDates(
  from: Date,
  count: number,
  daysBetween: number,
  timeZone: string = DEFAULT_TENANT_TIMEZONE,
): Date[] {
  const installments = Math.max(Math.trunc(count) || 1, 1);

  return Array.from({ length: installments }, (_, index) =>
    civilDaysFrom(from, (index + 1) * daysBetween, timeZone),
  );
}

/**
 * `YYYY-MM-DD` of an instant as seen in the tenant timezone. Use it to bucket
 * records by day — `toISOString().slice(0, 10)` buckets by UTC day and drops
 * every record made after 21:00 in UTC-3 into the next day (TZ-01).
 */
export function toLocalDateKey(
  instant: Date,
  timeZone: string = DEFAULT_TENANT_TIMEZONE,
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
