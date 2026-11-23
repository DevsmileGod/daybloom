import type { PlanStep } from "wasp/entities";
import type { DateKey } from "../lib/dates";
import { clamp, MINUTES_PER_DAY } from "../lib/time";
import type { PlanWithSteps } from "../types";

/** Height of one hour in the time grid. */
export const HOUR_HEIGHT_PX = 48;
/** Short steps still get a block tall enough to read and to grab. */
export const MIN_BLOCK_HEIGHT_PX = 20;
export const SNAP_MINUTES = 15;

export const DEFAULT_WINDOW_START_HOUR = 6;
export const DEFAULT_WINDOW_END_HOUR = 22;

export type CalendarView = "day" | "week";

export function isCalendarView(value: unknown): value is CalendarView {
  return value === "day" || value === "week";
}

export interface DayPlan {
  /** The newest plan of the day; its steps are the ones shown. */
  plan: PlanWithSteps;
  /** How many other (older) plans exist for the same day. */
  olderPlanCount: number;
}

/**
 * Groups plans by day and keeps the newest plan (max `createdAt`) per day.
 */
export function getLatestPlanPerDay(
  plans: PlanWithSteps[],
): Map<DateKey, DayPlan> {
  const byDay = new Map<DateKey, DayPlan>();
  for (const plan of plans) {
    const current = byDay.get(plan.date);
    if (!current) {
      byDay.set(plan.date, { plan, olderPlanCount: 0 });
      continue;
    }
    const isNewer =
      new Date(plan.createdAt).getTime() >
      new Date(current.plan.createdAt).getTime();
    byDay.set(plan.date, {
      plan: isNewer ? plan : current.plan,
      olderPlanCount: current.olderPlanCount + 1,
    });
  }
  return byDay;
}

export interface VisibleWindow {
  startHour: number;
  endHour: number;
}

/** Last minute a step occupies, kept inside the day. */
export function getStepEndMinute(step: {
  startMinute: number;
  plannedMinutes: number;
}): number {
  return Math.min(
    MINUTES_PER_DAY,
    step.startMinute + Math.max(1, step.plannedMinutes),
  );
}

/**
 * The hours shown in the grid: the preferred window, widened so that every
 * step is fully visible.
 */
export function getVisibleWindow(
  steps: { startMinute: number; plannedMinutes: number }[],
  preferred: VisibleWindow,
): VisibleWindow {
  let startHour = preferred.startHour;
  let endHour = preferred.endHour;
  for (const step of steps) {
    startHour = Math.min(startHour, Math.floor(step.startMinute / 60));
    endHour = Math.max(endHour, Math.ceil(getStepEndMinute(step) / 60));
  }
  startHour = clamp(startHour, 0, 23);
  endHour = clamp(endHour, startHour + 1, 24);
  return { startHour, endHour };
}

export function minutesToPx(minutes: number): number {
  return (minutes / 60) * HOUR_HEIGHT_PX;
}

export function pxToMinutes(px: number): number {
  return (px / HOUR_HEIGHT_PX) * 60;
}

/** Tailwind classes for a step block, by task priority. */
export function getPriorityClasses(priority: string): string {
  switch (priority) {
    case "high":
      return "border-destructive bg-destructive/10 hover:bg-destructive/15";
    case "medium":
      return "border-warning bg-warning/10 hover:bg-warning/15";
    case "low":
      return "border-success bg-success/10 hover:bg-success/15";
    default:
      return "border-primary bg-primary/10 hover:bg-primary/15";
  }
}

/** Applies optimistic start times to a plan's steps. */
export function applyStartOverrides(
  steps: PlanStep[],
  overrides: Record<string, number>,
): PlanStep[] {
  return steps.map((step) => {
    const override = overrides[step.id];
    return override === undefined ? step : { ...step, startMinute: override };
  });
}
