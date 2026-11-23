import type {
  GeneratedSchedule,
  TaskPriority,
} from "../../demo-ai-app/schedule";
import { clamp, MINUTES_PER_DAY, snapMinutes } from "./time";

export const PRIORITIES: TaskPriority[] = ["high", "medium", "low"];

const PRIORITY_RANK: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export const MIN_STEP_MINUTES = 5;

export function isTaskPriority(value: string): value is TaskPriority {
  return value === "high" || value === "medium" || value === "low";
}

export function comparePriorities(a: string, b: string): number {
  const rankA = isTaskPriority(a) ? PRIORITY_RANK[a] : PRIORITIES.length;
  const rankB = isTaskPriority(b) ? PRIORITY_RANK[b] : PRIORITIES.length;
  return rankA - rankB;
}

export interface DraftStep {
  taskName: string;
  taskPriority: TaskPriority;
  description: string;
  plannedMinutes: number;
}

export interface ScheduledStep extends DraftStep {
  position: number;
  startMinute: number;
}

/**
 * Flattens the AI-generated schedule into an ordered list of steps.
 * Tasks are ordered by priority (high first, keeping the AI's order for
 * ties), and each task's sub-steps stay together in the order returned.
 * Sub-steps for task names the AI didn't list as tasks are appended at the end
 * with medium priority, so no work silently disappears.
 */
export function buildStepsFromSchedule(
  schedule: GeneratedSchedule,
): DraftStep[] {
  const orderedTasks = schedule.tasks
    .map((task, index) => ({ task, index }))
    .sort(
      (a, b) =>
        comparePriorities(a.task.priority, b.task.priority) ||
        a.index - b.index,
    )
    .map(({ task }) => task);

  const knownTaskNames = new Set(orderedTasks.map((task) => task.name));
  const toDraft = (
    taskName: string,
    taskPriority: TaskPriority,
    description: string,
    hours: number,
  ): DraftStep => ({
    taskName,
    taskPriority,
    description,
    plannedMinutes: Math.max(MIN_STEP_MINUTES, Math.round(hours * 60)),
  });

  const steps: DraftStep[] = [];
  for (const task of orderedTasks) {
    for (const item of schedule.taskItems) {
      if (item.taskName === task.name) {
        steps.push(
          toDraft(task.name, task.priority, item.description, item.time),
        );
      }
    }
  }
  for (const item of schedule.taskItems) {
    if (!knownTaskNames.has(item.taskName)) {
      steps.push(toDraft(item.taskName, "medium", item.description, item.time));
    }
  }
  return steps;
}

/**
 * Lays steps out back to back starting at `startMinute`.
 * Start times never go past the last minute of the day.
 */
export function assignStartTimes<T extends { plannedMinutes: number }>(
  steps: T[],
  startMinute: number,
): (T & { position: number; startMinute: number })[] {
  let cursor = clamp(Math.round(startMinute), 0, MINUTES_PER_DAY - 1);
  return steps.map((step, position) => {
    const scheduled = { ...step, position, startMinute: cursor };
    cursor = Math.min(MINUTES_PER_DAY - 1, cursor + step.plannedMinutes);
    return scheduled;
  });
}

/**
 * Moves the step with `stepId` to `toIndex` and re-flows the whole day from
 * the original first start time, so the plan stays gap-free.
 */
export function moveStep<
  T extends { id: string; plannedMinutes: number; startMinute: number },
>(steps: T[], stepId: string, toIndex: number): (T & { position: number })[] {
  const fromIndex = steps.findIndex((step) => step.id === stepId);
  if (fromIndex === -1) {
    return steps.map((step, position) => ({ ...step, position }));
  }
  const firstStart = Math.min(...steps.map((step) => step.startMinute));
  const reordered = [...steps];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(clamp(toIndex, 0, reordered.length), 0, moved);
  return assignStartTimes(reordered, firstStart);
}

/**
 * Snaps a dropped start time onto the grid and keeps the step inside the day.
 */
export function normalizeStartMinute(
  startMinute: number,
  plannedMinutes: number,
  step = 15,
): number {
  const latestStart = Math.max(0, MINUTES_PER_DAY - plannedMinutes);
  return clamp(snapMinutes(startMinute, step), 0, latestStart);
}

export interface TimedStep {
  id: string;
  startMinute: number;
  plannedMinutes: number;
}

/** Pairs of step ids whose time ranges overlap. */
export function findOverlaps(steps: TimedStep[]): [string, string][] {
  const sorted = [...steps].sort((a, b) => a.startMinute - b.startMinute);
  const overlaps: [string, string][] = [];
  for (let i = 0; i < sorted.length; i++) {
    const end = sorted[i].startMinute + sorted[i].plannedMinutes;
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].startMinute >= end) break;
      overlaps.push([sorted[i].id, sorted[j].id]);
    }
  }
  return overlaps;
}

export interface LaidOutStep<T> {
  step: T;
  column: number;
  columnCount: number;
}

/**
 * Assigns side-by-side columns to overlapping steps for calendar rendering,
 * like most calendar apps do for overlapping events.
 */
export function layoutOverlappingSteps<T extends TimedStep>(
  steps: T[],
): LaidOutStep<T>[] {
  const sorted = [...steps].sort(
    (a, b) =>
      a.startMinute - b.startMinute || b.plannedMinutes - a.plannedMinutes,
  );
  const result: LaidOutStep<T>[] = [];
  let cluster: { step: T; column: number }[] = [];
  let clusterEnd = -1;
  let columnEnds: number[] = [];

  const flushCluster = () => {
    const columnCount = Math.max(1, columnEnds.length);
    for (const entry of cluster) {
      result.push({ ...entry, columnCount });
    }
    cluster = [];
    columnEnds = [];
  };

  for (const step of sorted) {
    const end = step.startMinute + Math.max(1, step.plannedMinutes);
    if (step.startMinute >= clusterEnd) {
      flushCluster();
    }
    let column = columnEnds.findIndex(
      (columnEnd) => columnEnd <= step.startMinute,
    );
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(end);
    } else {
      columnEnds[column] = end;
    }
    cluster.push({ step, column });
    clusterEnd = Math.max(clusterEnd, end);
  }
  flushCluster();
  return result;
}

export function getTotalPlannedMinutes(
  steps: { plannedMinutes: number }[],
): number {
  return steps.reduce((total, step) => total + step.plannedMinutes, 0);
}
