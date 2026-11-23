import type { Plan, PlanStep } from "wasp/entities";
import type { PeriodStats, PlanSummary } from "./lib/stats";

export type PlanWithSteps = Plan & { steps: PlanStep[] };

export type PlanListItem = Plan & {
  summary: PlanSummary;
  taskNames: string[];
};

export interface PlanListPage {
  plans: PlanListItem[];
  /** Pass as `cursor` to load the next page; null when there are no more. */
  nextCursor: string | null;
}

export interface PlannerStats extends PeriodStats {
  from: string;
  to: string;
  today: string;
  streak: number;
}
