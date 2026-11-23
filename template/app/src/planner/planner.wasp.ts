import { action, page, query, route, type Spec } from "@wasp/spec";

import { CalendarPage } from "./CalendarPage" with { type: "ref" };
import {
  addPlanStep,
  deletePlan,
  deletePlanStep,
  duplicatePlanToDate,
  generatePlan,
  getPlanById,
  getPlanForDate,
  getPlannerStats,
  getPlans,
  getPlansInRange,
  reorderPlanStep,
  startStepTimer,
  stopStepTimer,
  updatePlanNote,
  updatePlanStep,
} from "./operations" with { type: "ref" };
import { PlanDetailPage } from "./PlanDetailPage" with { type: "ref" };
import { PlanHistoryPage } from "./PlanHistoryPage" with { type: "ref" };
import { PlannerPage } from "./PlannerPage" with { type: "ref" };
import { StatsPage } from "./StatsPage" with { type: "ref" };

export const plannerSpec: Spec = [
  route("PlannerRoute", "/planner", page(PlannerPage, { authRequired: true })),
  route(
    "PlanHistoryRoute",
    "/plans",
    page(PlanHistoryPage, { authRequired: true }),
  ),
  route(
    "PlanDetailRoute",
    "/plans/:planId",
    page(PlanDetailPage, { authRequired: true }),
  ),
  route(
    "CalendarRoute",
    "/calendar",
    page(CalendarPage, { authRequired: true }),
  ),
  route("StatsRoute", "/stats", page(StatsPage, { authRequired: true })),

  query(getPlanForDate, { entities: ["Plan", "PlanStep"] }),
  query(getPlanById, { entities: ["Plan", "PlanStep"] }),
  query(getPlans, { entities: ["Plan", "PlanStep"] }),
  query(getPlansInRange, { entities: ["Plan", "PlanStep"] }),
  query(getPlannerStats, { entities: ["Plan", "PlanStep"] }),

  action(generatePlan, { entities: ["User", "Task", "Plan", "PlanStep"] }),
  action(duplicatePlanToDate, { entities: ["Plan", "PlanStep"] }),
  action(updatePlanStep, { entities: ["PlanStep"] }),
  action(reorderPlanStep, { entities: ["PlanStep"] }),
  action(addPlanStep, { entities: ["Plan", "PlanStep"] }),
  action(deletePlanStep, { entities: ["PlanStep"] }),
  action(startStepTimer, { entities: ["PlanStep"] }),
  action(stopStepTimer, { entities: ["PlanStep"] }),
  action(updatePlanNote, { entities: ["Plan", "PlanStep"] }),
  action(deletePlan, { entities: ["Plan", "PlanStep"] }),
];
