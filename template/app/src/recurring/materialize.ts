import type { RecurringTask } from "wasp/entities";
import type { PrismaClient } from "wasp/server";
import { getLocalDateKey, type DateKey } from "../planner/lib/dates";
import { isRecurringTaskDueOn } from "./recurrence";

type TaskDelegate = PrismaClient["task"];

/**
 * Creates today's task for each recurring task that is due on `dateKey`.
 *
 * Idempotent: `Task` has a unique constraint on (recurringTaskId, sourceDate),
 * and `skipDuplicates` makes repeated runs for the same day a no-op.
 *
 * @returns how many tasks were created.
 */
export async function materializeRecurringTasksForDate(
  recurringTasks: Pick<
    RecurringTask,
    "id" | "userId" | "description" | "time" | "frequency" | "daysOfWeek" | "isActive"
  >[],
  dateKey: DateKey,
  taskDelegate: TaskDelegate,
): Promise<number> {
  const due = recurringTasks.filter(
    (recurringTask) =>
      recurringTask.isActive && isRecurringTaskDueOn(recurringTask, dateKey),
  );
  if (due.length === 0) return 0;

  const { count } = await taskDelegate.createMany({
    data: due.map((recurringTask) => ({
      userId: recurringTask.userId,
      description: recurringTask.description,
      time: recurringTask.time,
      recurringTaskId: recurringTask.id,
      sourceDate: dateKey,
    })),
    skipDuplicates: true,
  });
  return count;
}

/** Today's date key for a user, falling back to UTC for invalid zones. */
export function getUserToday(timeZone: string, now: Date = new Date()): DateKey {
  try {
    return getLocalDateKey(now, timeZone);
  } catch {
    return getLocalDateKey(now, "UTC");
  }
}
