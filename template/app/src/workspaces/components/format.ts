import {
  compareDateKeys,
  formatDateKey,
  isValidDateKey,
} from "../../planner/lib/dates";

interface NamedUser {
  email: string | null;
  username: string | null;
}

/** The name we show for a workspace member or task assignee. */
export function getUserLabel(user: NamedUser): string {
  return user.username ?? user.email ?? "Unknown user";
}

/** Up to two initials for an avatar fallback. */
export function getInitials(user: NamedUser): string {
  const label = user.username ?? user.email?.split("@")[0] ?? "?";
  const parts = label.split(/[\s._-]+/).filter(Boolean);
  const initials =
    parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : label.slice(0, 2);
  return initials.toUpperCase();
}

/** Mirrors the server's validation of a task's hours. */
export function isValidHours(value: string): boolean {
  const hours = Number.parseFloat(value.trim());
  return Number.isFinite(hours) && hours > 0 && hours <= 24;
}

export function formatHours(value: string): string {
  const hours = Number.parseFloat(value);
  if (!Number.isFinite(hours)) return value;
  return `${hours} h`;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(date),
  );
}

export function formatDueDate(dueDate: string): string {
  if (!isValidDateKey(dueDate)) return dueDate;
  return formatDateKey(dueDate, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function isOverdue(
  task: { dueDate: string | null; isDone: boolean },
  todayKey: string,
): boolean {
  return (
    !task.isDone &&
    !!task.dueDate &&
    isValidDateKey(task.dueDate) &&
    compareDateKeys(task.dueDate, todayKey) < 0
  );
}
