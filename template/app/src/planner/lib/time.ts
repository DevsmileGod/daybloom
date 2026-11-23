export const MINUTES_PER_DAY = 24 * 60;

/** 570 -> "09:30" */
export function formatMinutesAsClock(minuteOfDay: number): string {
  const normalized =
    ((Math.round(minuteOfDay) % MINUTES_PER_DAY) + MINUTES_PER_DAY) %
    MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (normalized % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** "09:30" -> 570. Returns null for anything that is not a valid HH:MM time. */
export function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** 95 -> "1h 35m", 30 -> "30m", 0 -> "0m" */
export function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

/**
 * Tasks store their estimate as a string of hours (e.g. "1.5"), because that
 * is what the original task form uses. Converts it to whole minutes.
 */
export function hoursStringToMinutes(hours: string): number {
  const parsed = Number.parseFloat(hours);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * 60);
}

/** Rounds `minutes` to the nearest multiple of `step`. */
export function snapMinutes(minutes: number, step = 15): number {
  return Math.round(minutes / step) * step;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Whole minutes elapsed between two instants, never negative. */
export function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
}
