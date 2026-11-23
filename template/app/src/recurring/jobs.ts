import type { MaterializeRecurringTasksJob } from "wasp/server/jobs";
import { getUserToday, materializeRecurringTasksForDate } from "./materialize";

/**
 * Runs every hour. For each user with active recurring tasks, creates the
 * tasks due "today" in that user's own time zone. Because creation is
 * idempotent, running hourly simply picks up each user's new day shortly
 * after their local midnight.
 */
export const materializeRecurringTasksJob: MaterializeRecurringTasksJob<
  never,
  { createdTasks: number; users: number }
> = async (_args, context) => {
  const recurringTasks = await context.entities.RecurringTask.findMany({
    where: { isActive: true },
    include: { user: { select: { timeZone: true } } },
  });

  const byUser = new Map<string, typeof recurringTasks>();
  for (const recurringTask of recurringTasks) {
    byUser.set(recurringTask.userId, [
      ...(byUser.get(recurringTask.userId) ?? []),
      recurringTask,
    ]);
  }

  let createdTasks = 0;
  for (const userRecurringTasks of byUser.values()) {
    const today = getUserToday(userRecurringTasks[0].user.timeZone);
    try {
      createdTasks += await materializeRecurringTasksForDate(
        userRecurringTasks,
        today,
        context.entities.Task,
      );
    } catch (error) {
      // One user's failure shouldn't stop everyone else's tasks.
      console.error("Failed to create recurring tasks for a user", error);
    }
  }

  return { createdTasks, users: byUser.size };
};
