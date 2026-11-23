import { formatMinutesAsClock, formatDuration } from "../planner/lib/time";

export interface RemindableStep {
  id: string;
  description: string;
  taskName: string;
  startMinute: number;
  plannedMinutes: number;
  isDone: boolean;
  remindedAt: Date | null;
}

export const MIN_REMINDER_LEAD_MINUTES = 0;
export const MAX_REMINDER_LEAD_MINUTES = 120;

/**
 * Steps that should get a reminder now: not done, not reminded yet, and
 * starting within the next `leadMinutes`. Steps that started up to
 * `graceMinutes` ago are included too, so a reminder isn't lost when the job
 * runs a little late.
 */
export function selectStepsToRemind<T extends RemindableStep>(
  steps: T[],
  nowMinute: number,
  leadMinutes: number,
  graceMinutes = 5,
): T[] {
  return steps
    .filter(
      (step) =>
        !step.isDone &&
        step.remindedAt === null &&
        step.startMinute >= nowMinute - graceMinutes &&
        step.startMinute <= nowMinute + leadMinutes,
    )
    .sort((a, b) => a.startMinute - b.startMinute);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface ReminderEmail {
  subject: string;
  text: string;
  html: string;
}

export function buildReminderEmail(
  steps: RemindableStep[],
  plannerUrl: string,
): ReminderEmail {
  const [first] = steps;
  const subject =
    steps.length === 1
      ? `Up next at ${formatMinutesAsClock(first.startMinute)}: ${first.description}`
      : `Up next: ${steps.length} steps starting soon`;

  const lines = steps.map(
    (step) =>
      `${formatMinutesAsClock(step.startMinute)} · ${step.description} (${formatDuration(step.plannedMinutes)}, ${step.taskName})`,
  );

  const text = [
    "Here's what's coming up in your Daybloom plan:",
    "",
    ...lines,
    "",
    `Open your plan: ${plannerUrl}`,
    "",
    "You can turn these reminders off in your Daybloom settings.",
  ].join("\n");

  const htmlItems = steps
    .map(
      (step) =>
        `<li><strong>${formatMinutesAsClock(step.startMinute)}</strong> · ${escapeHtml(step.description)} <span style="color:#6b7280">(${formatDuration(step.plannedMinutes)}, ${escapeHtml(step.taskName)})</span></li>`,
    )
    .join("");

  const html = `<p>Here's what's coming up in your Daybloom plan:</p><ul>${htmlItems}</ul><p><a href="${escapeHtml(plannerUrl)}">Open your plan</a></p><p style="color:#6b7280;font-size:12px">You can turn these reminders off in your Daybloom settings.</p>`;

  return { subject, text, html };
}
