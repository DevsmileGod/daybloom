import { action, query, type Spec } from "@wasp/spec";

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

export const plannerSpec: Spec = [
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
