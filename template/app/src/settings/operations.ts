import { HttpError } from "wasp/server";
import type {
  GetPlannerSettings,
  UpdatePlannerSettings,
} from "wasp/server/operations";
import * as z from "zod";
import { isValidTimeZone } from "../planner/lib/dates";
import { MINUTES_PER_DAY } from "../planner/lib/time";
import {
  MAX_REMINDER_LEAD_MINUTES,
  MIN_REMINDER_LEAD_MINUTES,
} from "../reminders/reminders";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";

export interface PlannerSettings {
  timeZone: string;
  workdayStartMinutes: number;
  emailRemindersEnabled: boolean;
  reminderLeadMinutes: number;
  /** Email reminders need an email address on the account. */
  hasEmail: boolean;
}

const settingsSelect = {
  timeZone: true,
  workdayStartMinutes: true,
  emailRemindersEnabled: true,
  reminderLeadMinutes: true,
  email: true,
} as const;

function toPlannerSettings(user: {
  timeZone: string;
  workdayStartMinutes: number;
  emailRemindersEnabled: boolean;
  reminderLeadMinutes: number;
  email: string | null;
}): PlannerSettings {
  return {
    timeZone: user.timeZone,
    workdayStartMinutes: user.workdayStartMinutes,
    emailRemindersEnabled: user.emailRemindersEnabled,
    reminderLeadMinutes: user.reminderLeadMinutes,
    hasEmail: !!user.email,
  };
}

export const getPlannerSettings: GetPlannerSettings<
  void,
  PlannerSettings
> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  const user = await context.entities.User.findUniqueOrThrow({
    where: { id: context.user.id },
    select: settingsSelect,
  });
  return toPlannerSettings(user);
};

const updatePlannerSettingsInputSchema = z.object({
  timeZone: z
    .string()
    .refine(isValidTimeZone, { message: "Unknown time zone" })
    .optional(),
  workdayStartMinutes: z
    .number()
    .int()
    .min(0)
    .max(MINUTES_PER_DAY - 1)
    .optional(),
  emailRemindersEnabled: z.boolean().optional(),
  reminderLeadMinutes: z
    .number()
    .int()
    .min(MIN_REMINDER_LEAD_MINUTES)
    .max(MAX_REMINDER_LEAD_MINUTES)
    .optional(),
});

export const updatePlannerSettings: UpdatePlannerSettings<
  z.infer<typeof updatePlannerSettingsInputSchema>,
  PlannerSettings
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  const changes = ensureArgsSchemaOrThrowHttpError(
    updatePlannerSettingsInputSchema,
    rawArgs,
  );
  if (changes.emailRemindersEnabled && !context.user.email) {
    throw new HttpError(
      400,
      "Add an email address to your account to get email reminders",
    );
  }

  const user = await context.entities.User.update({
    where: { id: context.user.id },
    data: changes,
    select: settingsSelect,
  });
  return toPlannerSettings(user);
};
