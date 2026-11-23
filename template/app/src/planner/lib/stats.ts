import { addDaysToDateKey, type DateKey } from "./dates";
import { comparePriorities } from "./scheduling";

export interface StatsStep {
  taskName: string;
  taskPriority: string;
  plannedMinutes: number;
  actualMinutes: number;
  isDone: boolean;
}

export interface StatsPlan {
  date: DateKey;
  steps: StatsStep[];
}

export interface PlanSummary {
  totalSteps: number;
  doneSteps: number;
  plannedMinutes: number;
  completedPlannedMinutes: number;
  trackedMinutes: number;
  /** 0..1, share of steps marked done. 0 for an empty plan. */
  completionRate: number;
}

export function summarizeSteps(steps: StatsStep[]): PlanSummary {
  let doneSteps = 0;
  let plannedMinutes = 0;
  let completedPlannedMinutes = 0;
  let trackedMinutes = 0;
  for (const step of steps) {
    plannedMinutes += step.plannedMinutes;
    trackedMinutes += step.actualMinutes;
    if (step.isDone) {
      doneSteps += 1;
      completedPlannedMinutes += step.plannedMinutes;
    }
  }
  return {
    totalSteps: steps.length,
    doneSteps,
    plannedMinutes,
    completedPlannedMinutes,
    trackedMinutes,
    completionRate: steps.length === 0 ? 0 : doneSteps / steps.length,
  };
}

export interface DayStats extends PlanSummary {
  date: DateKey;
  planCount: number;
}

export interface PriorityStats {
  priority: string;
  totalSteps: number;
  doneSteps: number;
  completionRate: number;
}

export interface TaskTimeStats {
  taskName: string;
  plannedMinutes: number;
  trackedMinutes: number;
  doneSteps: number;
  totalSteps: number;
}

export interface PeriodStats {
  days: DayStats[];
  totals: PlanSummary;
  byPriority: PriorityStats[];
  topTasks: TaskTimeStats[];
  /**
   * Tracked time divided by planned time for finished steps that have
   * tracked time. Above 1 means steps take longer than planned.
   * Null when nothing has been tracked yet.
   */
  estimateRatio: number | null;
  /** Days in the period where at least one step was finished. */
  activeDays: number;
}

/**
 * Aggregates plans into per-day and whole-period statistics.
 * @param dateKeys the days of the period, in order. Plans outside it are ignored.
 */
export function computePeriodStats(
  plans: StatsPlan[],
  dateKeys: DateKey[],
  topTaskLimit = 5,
): PeriodStats {
  const inPeriod = new Set(dateKeys);
  const stepsByDay = new Map<DateKey, StatsStep[]>();
  const planCountByDay = new Map<DateKey, number>();
  for (const plan of plans) {
    if (!inPeriod.has(plan.date)) continue;
    stepsByDay.set(plan.date, [
      ...(stepsByDay.get(plan.date) ?? []),
      ...plan.steps,
    ]);
    planCountByDay.set(plan.date, (planCountByDay.get(plan.date) ?? 0) + 1);
  }

  const days: DayStats[] = dateKeys.map((date) => ({
    date,
    planCount: planCountByDay.get(date) ?? 0,
    ...summarizeSteps(stepsByDay.get(date) ?? []),
  }));

  const allSteps = [...stepsByDay.values()].flat();

  const priorityMap = new Map<string, { total: number; done: number }>();
  const taskMap = new Map<string, TaskTimeStats>();
  let estimatePlanned = 0;
  let estimateTracked = 0;

  for (const step of allSteps) {
    const priority = priorityMap.get(step.taskPriority) ?? {
      total: 0,
      done: 0,
    };
    priority.total += 1;
    if (step.isDone) priority.done += 1;
    priorityMap.set(step.taskPriority, priority);

    const task = taskMap.get(step.taskName) ?? {
      taskName: step.taskName,
      plannedMinutes: 0,
      trackedMinutes: 0,
      doneSteps: 0,
      totalSteps: 0,
    };
    task.plannedMinutes += step.plannedMinutes;
    task.trackedMinutes += step.actualMinutes;
    task.totalSteps += 1;
    if (step.isDone) task.doneSteps += 1;
    taskMap.set(step.taskName, task);

    if (step.isDone && step.actualMinutes > 0) {
      estimatePlanned += step.plannedMinutes;
      estimateTracked += step.actualMinutes;
    }
  }

  const byPriority = [...priorityMap.entries()]
    .map(([priority, { total, done }]) => ({
      priority,
      totalSteps: total,
      doneSteps: done,
      completionRate: total === 0 ? 0 : done / total,
    }))
    .sort((a, b) => comparePriorities(a.priority, b.priority));

  const topTasks = [...taskMap.values()]
    .sort(
      (a, b) =>
        Math.max(b.trackedMinutes, b.plannedMinutes) -
          Math.max(a.trackedMinutes, a.plannedMinutes) ||
        a.taskName.localeCompare(b.taskName),
    )
    .slice(0, topTaskLimit);

  return {
    days,
    totals: summarizeSteps(allSteps),
    byPriority,
    topTasks,
    estimateRatio:
      estimatePlanned === 0 ? null : estimateTracked / estimatePlanned,
    activeDays: days.filter((day) => day.doneSteps > 0).length,
  };
}

/**
 * Number of consecutive days, ending today (or yesterday, if nothing is done
 * yet today), with at least one finished step.
 */
export function computeStreak(
  activeDateKeys: Iterable<DateKey>,
  today: DateKey,
): number {
  const active = new Set(activeDateKeys);
  let cursor = active.has(today) ? today : addDaysToDateKey(today, -1);
  let streak = 0;
  while (active.has(cursor)) {
    streak += 1;
    cursor = addDaysToDateKey(cursor, -1);
  }
  return streak;
}
