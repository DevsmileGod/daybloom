import { routes } from "wasp/client/router";
import { config } from "wasp/server";
import { emailSender } from "wasp/server/email";
import type { SendStepRemindersJob } from "wasp/server/jobs";
import { getLocalMinuteOfDay } from "../planner/lib/dates";
import { getUserToday } from "../recurring/materialize";
import { buildReminderEmail, selectStepsToRemind } from "./reminders";

const PLANNER_URL = `${config.frontendUrl}${routes.PlannerRoute.to}`;

function getUserMinuteOfDay(timeZone: string, now: Date): number {
  try {
    return getLocalMinuteOfDay(now, timeZone);
  } catch {
    return getLocalMinuteOfDay(now, "UTC");
  }
}

/**
 * Runs every 5 minutes. Emails users who enabled reminders about plan steps
 * for their local "today" that start within their chosen lead time.
 * Each step is reminded at most once (`remindedAt`).
 */
export const sendStepRemindersJob: SendStepRemindersJob<
  never,
  { emailsSent: number; stepsReminded: number }
> = async (_args, context) => {
  const now = new Date();
  const users = await context.entities.User.findMany({
    where: { emailRemindersEnabled: true, email: { not: null } },
    select: {
      id: true,
      email: true,
      timeZone: true,
      reminderLeadMinutes: true,
    },
  });

  let emailsSent = 0;
  let stepsReminded = 0;

  for (const user of users) {
    if (!user.email) continue;
    const today = getUserToday(user.timeZone, now);
    const nowMinute = getUserMinuteOfDay(user.timeZone, now);

    // The latest plan for today is the one the user is working from.
    const plan = await context.entities.Plan.findFirst({
      where: { userId: user.id, date: today },
      orderBy: { createdAt: "desc" },
      include: { steps: true },
    });
    if (!plan) continue;

    const dueSteps = selectStepsToRemind(
      plan.steps,
      nowMinute,
      user.reminderLeadMinutes,
    );
    if (dueSteps.length === 0) continue;

    try {
      // Mark first, so a slow or failing email provider never causes the
      // same reminder to be sent twice on the next run.
      await context.entities.PlanStep.updateMany({
        where: { id: { in: dueSteps.map((step) => step.id) }, remindedAt: null },
        data: { remindedAt: now },
      });
      await emailSender.send({
        to: user.email,
        ...buildReminderEmail(dueSteps, PLANNER_URL),
      });
      emailsSent += 1;
      stepsReminded += dueSteps.length;
    } catch (error) {
      console.error("Failed to send a plan reminder", error);
    }
  }

  return { emailsSent, stepsReminded };
};
