import { action, job, page, query, route, type Spec } from "@wasp/spec";

import { materializeRecurringTasksJob } from "./jobs" with { type: "ref" };
import {
  addDueRecurringTasksNow,
  applyPlanTemplate,
  createPlanTemplate,
  createRecurringTask,
  deletePlanTemplate,
  deleteRecurringTask,
  getPlanTemplates,
  getRecurringTasks,
  updatePlanTemplate,
  updateRecurringTask,
} from "./operations" with { type: "ref" };
import { RoutinesPage } from "./RoutinesPage" with { type: "ref" };

export const recurringSpec: Spec = [
  route(
    "RoutinesRoute",
    "/routines",
    page(RoutinesPage, { authRequired: true }),
  ),

  query(getRecurringTasks, { entities: ["RecurringTask"] }),
  action(createRecurringTask, { entities: ["RecurringTask"] }),
  action(updateRecurringTask, { entities: ["RecurringTask"] }),
  action(deleteRecurringTask, { entities: ["RecurringTask"] }),
  action(addDueRecurringTasksNow, { entities: ["RecurringTask", "Task"] }),

  query(getPlanTemplates, { entities: ["PlanTemplate", "PlanTemplateItem"] }),
  action(createPlanTemplate, {
    entities: ["PlanTemplate", "PlanTemplateItem", "Task"],
  }),
  action(updatePlanTemplate, {
    entities: ["PlanTemplate", "PlanTemplateItem"],
  }),
  action(deletePlanTemplate, {
    entities: ["PlanTemplate", "PlanTemplateItem"],
  }),
  action(applyPlanTemplate, {
    entities: ["PlanTemplate", "PlanTemplateItem", "Task"],
  }),

  job(materializeRecurringTasksJob, {
    executor: "PgBoss",
    schedule: {
      cron: "5 * * * *", // Every hour, 5 minutes past.
    },
    entities: ["RecurringTask", "Task", "User"],
  }),
];
