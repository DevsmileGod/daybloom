import { job, type Spec } from "@wasp/spec";

import { sendStepRemindersJob } from "./jobs" with { type: "ref" };

export const remindersSpec: Spec = [
  job(sendStepRemindersJob, {
    executor: "PgBoss",
    schedule: {
      cron: "*/5 * * * *", // Every 5 minutes.
    },
    entities: ["User", "Plan", "PlanStep"],
  }),
];
