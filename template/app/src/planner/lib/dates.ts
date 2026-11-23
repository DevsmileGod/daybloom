/**
 * Calendar-date helpers.
 *
 * Plans are attached to a local calendar day of the user, not to an instant in
 * time, so we store days as `YYYY-MM-DD` strings ("date keys") and do all day
 * arithmetic in UTC to stay independent of the server's own time zone.
 */

export type DateKey = string;

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const SHORT_DAY_NAMES = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

export function isValidDateKey(value: string): value is DateKey {
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseDateKey(key: DateKey): Date {
  if (!isValidDateKey(key)) {
    throw new Error(`Invalid date key: ${key}`);
  }
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toDateKeyFromUtcDate(date: Date): DateKey {
  const year = date.getUTCFullYear().toString().padStart(4, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getZonedParts(instant: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== "literal") {
      parts[part.type] = Number(part.value);
    }
  }
  return {
    year: parts.year ?? 1970,
    month: parts.month ?? 1,
    day: parts.day ?? 1,
    // Some engines report midnight as hour 24.
    hour: (parts.hour ?? 0) % 24,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
}

/** The calendar day of `instant` as seen in `timeZone`. */
export function getLocalDateKey(instant: Date, timeZone: string): DateKey {
  const { year, month, day } = getZonedParts(instant, timeZone);
  return toDateKeyFromUtcDate(new Date(Date.UTC(year, month - 1, day)));
}

/** Minutes since local midnight of `instant` as seen in `timeZone`. */
export function getLocalMinuteOfDay(instant: Date, timeZone: string): number {
  const { hour, minute } = getZonedParts(instant, timeZone);
  return hour * 60 + minute;
}

/** Offset of `timeZone` from UTC at `instant`, in minutes (e.g. +60 for CET). */
export function getTimeZoneOffsetMinutes(
  instant: Date,
  timeZone: string,
): number {
  const parts = getZonedParts(instant, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const instantWithoutMs = Math.floor(instant.getTime() / 1000) * 1000;
  return Math.round((asUtc - instantWithoutMs) / 60000);
}

/**
 * Converts a local wall-clock time (date key + minutes after midnight) in
 * `timeZone` to the matching instant.
 */
export function localDateTimeToInstant(
  key: DateKey,
  minuteOfDay: number,
  timeZone: string,
): Date {
  const day = parseDateKey(key);
  const wallClockAsUtc = day.getTime() + minuteOfDay * 60000;
  // First guess using the offset at the wall-clock time, then correct once in
  // case the guess crossed a daylight saving time transition.
  let offset = getTimeZoneOffsetMinutes(new Date(wallClockAsUtc), timeZone);
  let instant = wallClockAsUtc - offset * 60000;
  const correctedOffset = getTimeZoneOffsetMinutes(new Date(instant), timeZone);
  if (correctedOffset !== offset) {
    offset = correctedOffset;
    instant = wallClockAsUtc - offset * 60000;
  }
  return new Date(instant);
}

export function addDaysToDateKey(key: DateKey, days: number): DateKey {
  return toDateKeyFromUtcDate(
    new Date(parseDateKey(key).getTime() + days * MS_PER_DAY),
  );
}

/** 0 = Sunday ... 6 = Saturday */
export function getDayOfWeek(key: DateKey): number {
  return parseDateKey(key).getUTCDay();
}

export function compareDateKeys(a: DateKey, b: DateKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function diffInDays(from: DateKey, to: DateKey): number {
  return Math.round(
    (parseDateKey(to).getTime() - parseDateKey(from).getTime()) / MS_PER_DAY,
  );
}

/**
 * The 7 date keys of the week containing `key`.
 * @param weekStartsOn 0 = Sunday, 1 = Monday (default)
 */
export function getWeekDateKeys(key: DateKey, weekStartsOn = 1): DateKey[] {
  const offset = (getDayOfWeek(key) - weekStartsOn + 7) % 7;
  const start = addDaysToDateKey(key, -offset);
  return Array.from({ length: 7 }, (_, index) =>
    addDaysToDateKey(start, index),
  );
}

/** Inclusive range of date keys from `start` to `end`. */
export function getDateKeyRange(start: DateKey, end: DateKey): DateKey[] {
  const length = diffInDays(start, end) + 1;
  if (length <= 0) return [];
  return Array.from({ length }, (_, index) => addDaysToDateKey(start, index));
}

/** Human-readable date, e.g. "Mon, Nov 23". */
export function formatDateKey(
  key: DateKey,
  options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
  },
  locale?: string,
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
    parseDateKey(key),
  );
}

/** The browser's / runtime's own IANA time zone, falling back to UTC. */
export function getRuntimeTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Today's date key in the runtime's time zone. */
export function getTodayDateKey(timeZone = getRuntimeTimeZone()): DateKey {
  return getLocalDateKey(new Date(), timeZone);
}
