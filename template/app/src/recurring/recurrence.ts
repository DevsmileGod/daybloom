import {
  getDayOfWeek,
  SHORT_DAY_NAMES,
  type DateKey,
} from "../planner/lib/dates";

export const RECURRENCE_FREQUENCIES = ["daily", "weekdays", "weekly"] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export interface RecurrenceRule {
  frequency: string;
  daysOfWeek: number[];
}

export function isRecurrenceFrequency(
  value: string,
): value is RecurrenceFrequency {
  return (RECURRENCE_FREQUENCIES as readonly string[]).includes(value);
}

/** Removes duplicates and out-of-range values, sorted Sunday-first. */
export function normalizeDaysOfWeek(days: number[]): number[] {
  return [...new Set(days)]
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b);
}

/** Whether a recurring task should produce a task on `dateKey`. */
export function isRecurringTaskDueOn(
  rule: RecurrenceRule,
  dateKey: DateKey,
): boolean {
  const dayOfWeek = getDayOfWeek(dateKey);
  switch (rule.frequency) {
    case "daily":
      return true;
    case "weekdays":
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case "weekly":
      return normalizeDaysOfWeek(rule.daysOfWeek).includes(dayOfWeek);
    default:
      return false;
  }
}

/** "Every day", "Every weekday", "Every Mon, Wed, Fri" */
export function describeRecurrence(rule: RecurrenceRule): string {
  switch (rule.frequency) {
    case "daily":
      return "Every day";
    case "weekdays":
      return "Every weekday";
    case "weekly": {
      const days = normalizeDaysOfWeek(rule.daysOfWeek);
      if (days.length === 0) return "Never (no days selected)";
      if (days.length === 7) return "Every day";
      // Show Monday first, the way most people read a week.
      const mondayFirst = [
        ...days.filter((day) => day !== 0),
        ...days.filter((day) => day === 0),
      ];
      return `Every ${mondayFirst.map((day) => SHORT_DAY_NAMES[day]).join(", ")}`;
    }
    default:
      return "Unknown schedule";
  }
}

/** Validation error for a rule, or null when it is valid. */
export function validateRecurrenceRule(rule: RecurrenceRule): string | null {
  if (!isRecurrenceFrequency(rule.frequency)) {
    return `Unknown frequency "${rule.frequency}"`;
  }
  if (
    rule.frequency === "weekly" &&
    normalizeDaysOfWeek(rule.daysOfWeek).length === 0
  ) {
    return "Pick at least one day for a weekly task";
  }
  return null;
}
