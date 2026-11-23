import type {
  PlanTemplate,
  PlanTemplateItem,
  RecurringTask,
  Task,
} from "wasp/entities";
import { HttpError } from "wasp/server";
import type {
  AddDueRecurringTasksNow,
  ApplyPlanTemplate,
  CreatePlanTemplate,
  CreateRecurringTask,
  DeletePlanTemplate,
  DeleteRecurringTask,
  GetPlanTemplates,
  GetRecurringTasks,
  UpdatePlanTemplate,
  UpdateRecurringTask,
} from "wasp/server/operations";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import { getUserToday, materializeRecurringTasksForDate } from "./materialize";
import {
  normalizeDaysOfWeek,
  RECURRENCE_FREQUENCIES,
  validateRecurrenceRule,
} from "./recurrence";

export type PlanTemplateWithItems = PlanTemplate & {
  items: PlanTemplateItem[];
};

const MAX_RECURRING_TASKS = 50;
const MAX_TEMPLATES = 30;
const MAX_TEMPLATE_ITEMS = 30;

const idSchema = z.string().nonempty();
const descriptionSchema = z.string().trim().min(1).max(500);
/** Hours as a string, matching `Task.time`, e.g. "1.5". */
const hoursSchema = z
  .string()
  .trim()
  .refine(
    (value) => {
      const hours = Number.parseFloat(value);
      return Number.isFinite(hours) && hours > 0 && hours <= 24;
    },
    { message: "Time must be between 0 and 24 hours" },
  );

function requireUser<T>(user: T | undefined): T {
  if (!user) {
    throw new HttpError(401, "You need to be logged in to do that");
  }
  return user;
}

function assertValidRule(frequency: string, daysOfWeek: number[]) {
  const error = validateRecurrenceRule({ frequency, daysOfWeek });
  if (error) {
    throw new HttpError(400, error);
  }
}

//#region Recurring tasks

const createRecurringTaskInputSchema = z.object({
  description: descriptionSchema,
  time: hoursSchema.default("1"),
  frequency: z.enum(RECURRENCE_FREQUENCIES),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
});

export const createRecurringTask: CreateRecurringTask<
  z.input<typeof createRecurringTaskInputSchema>,
  RecurringTask
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { description, time, frequency, daysOfWeek } =
    ensureArgsSchemaOrThrowHttpError(createRecurringTaskInputSchema, rawArgs);
  assertValidRule(frequency, daysOfWeek);

  const existingCount = await context.entities.RecurringTask.count({
    where: { userId: user.id },
  });
  if (existingCount >= MAX_RECURRING_TASKS) {
    throw new HttpError(
      400,
      `You can have at most ${MAX_RECURRING_TASKS} recurring tasks`,
    );
  }

  return context.entities.RecurringTask.create({
    data: {
      user: { connect: { id: user.id } },
      description,
      time,
      frequency,
      daysOfWeek: frequency === "weekly" ? normalizeDaysOfWeek(daysOfWeek) : [],
    },
  });
};

const updateRecurringTaskInputSchema = z.object({
  id: idSchema,
  description: descriptionSchema.optional(),
  time: hoursSchema.optional(),
  frequency: z.enum(RECURRENCE_FREQUENCIES).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  isActive: z.boolean().optional(),
});

export const updateRecurringTask: UpdateRecurringTask<
  z.infer<typeof updateRecurringTaskInputSchema>,
  RecurringTask
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { id, ...changes } = ensureArgsSchemaOrThrowHttpError(
    updateRecurringTaskInputSchema,
    rawArgs,
  );

  const existing = await context.entities.RecurringTask.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    throw new HttpError(404, "Recurring task not found");
  }

  const frequency = changes.frequency ?? existing.frequency;
  const daysOfWeek = changes.daysOfWeek ?? existing.daysOfWeek;
  assertValidRule(frequency, daysOfWeek);

  return context.entities.RecurringTask.update({
    where: { id: existing.id },
    data: {
      description: changes.description,
      time: changes.time,
      isActive: changes.isActive,
      frequency,
      daysOfWeek: frequency === "weekly" ? normalizeDaysOfWeek(daysOfWeek) : [],
    },
  });
};

export const deleteRecurringTask: DeleteRecurringTask<
  { id: string },
  { id: string }
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { id } = ensureArgsSchemaOrThrowHttpError(
    z.object({ id: idSchema }),
    rawArgs,
  );
  // Tasks already created from it are kept; their link is cleared by the
  // `onDelete: SetNull` relation.
  const { count } = await context.entities.RecurringTask.deleteMany({
    where: { id, userId: user.id },
  });
  if (count === 0) {
    throw new HttpError(404, "Recurring task not found");
  }
  return { id };
};

/**
 * Adds today's due recurring tasks right away instead of waiting for the
 * hourly job, e.g. right after creating a new recurring task.
 */
export const addDueRecurringTasksNow: AddDueRecurringTasksNow<
  void,
  { createdTasks: number }
> = async (_args, context) => {
  const user = requireUser(context.user);
  const recurringTasks = await context.entities.RecurringTask.findMany({
    where: { userId: user.id, isActive: true },
  });
  const createdTasks = await materializeRecurringTasksForDate(
    recurringTasks,
    getUserToday(user.timeZone),
    context.entities.Task,
  );
  return { createdTasks };
};

export const getRecurringTasks: GetRecurringTasks<
  void,
  RecurringTask[]
> = async (_args, context) => {
  const user = requireUser(context.user);
  return context.entities.RecurringTask.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
};

//#endregion

//#region Templates

const templateItemSchema = z.object({
  description: descriptionSchema,
  time: hoursSchema.default("1"),
});

const createPlanTemplateInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  /** Items to save. When omitted, the user's current open tasks are used. */
  items: z.array(templateItemSchema).max(MAX_TEMPLATE_ITEMS).optional(),
});

export const createPlanTemplate: CreatePlanTemplate<
  z.input<typeof createPlanTemplateInputSchema>,
  PlanTemplateWithItems
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { name, items } = ensureArgsSchemaOrThrowHttpError(
    createPlanTemplateInputSchema,
    rawArgs,
  );

  const templateCount = await context.entities.PlanTemplate.count({
    where: { userId: user.id },
  });
  if (templateCount >= MAX_TEMPLATES) {
    throw new HttpError(400, `You can have at most ${MAX_TEMPLATES} templates`);
  }

  const templateItems =
    items ??
    (
      await context.entities.Task.findMany({
        where: { userId: user.id, isDone: false },
        orderBy: { createdAt: "asc" },
        take: MAX_TEMPLATE_ITEMS,
      })
    ).map((task) => ({ description: task.description, time: task.time }));

  if (templateItems.length === 0) {
    throw new HttpError(400, "A template needs at least one task");
  }

  return context.entities.PlanTemplate.create({
    data: {
      user: { connect: { id: user.id } },
      name,
      items: {
        create: templateItems.map((item, position) => ({ ...item, position })),
      },
    },
    include: { items: { orderBy: { position: "asc" } } },
  });
};

const updatePlanTemplateInputSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(100).optional(),
  /** Replaces all items when provided. */
  items: z.array(templateItemSchema).min(1).max(MAX_TEMPLATE_ITEMS).optional(),
});

export const updatePlanTemplate: UpdatePlanTemplate<
  z.input<typeof updatePlanTemplateInputSchema>,
  PlanTemplateWithItems
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { id, name, items } = ensureArgsSchemaOrThrowHttpError(
    updatePlanTemplateInputSchema,
    rawArgs,
  );

  const existing = await context.entities.PlanTemplate.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    throw new HttpError(404, "Template not found");
  }

  return context.entities.PlanTemplate.update({
    where: { id: existing.id },
    data: {
      name,
      ...(items
        ? {
            items: {
              deleteMany: {},
              create: items.map((item, position) => ({ ...item, position })),
            },
          }
        : {}),
    },
    include: { items: { orderBy: { position: "asc" } } },
  });
};

export const deletePlanTemplate: DeletePlanTemplate<
  { id: string },
  { id: string }
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { id } = ensureArgsSchemaOrThrowHttpError(
    z.object({ id: idSchema }),
    rawArgs,
  );
  const { count } = await context.entities.PlanTemplate.deleteMany({
    where: { id, userId: user.id },
  });
  if (count === 0) {
    throw new HttpError(404, "Template not found");
  }
  return { id };
};

/**
 * Adds every item of a template to the user's task list. Items whose
 * description matches an open task are skipped, so applying twice doesn't
 * create duplicates.
 */
export const applyPlanTemplate: ApplyPlanTemplate<
  { id: string },
  { created: Task[]; skipped: number }
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { id } = ensureArgsSchemaOrThrowHttpError(
    z.object({ id: idSchema }),
    rawArgs,
  );

  const template = await context.entities.PlanTemplate.findFirst({
    where: { id, userId: user.id },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!template) {
    throw new HttpError(404, "Template not found");
  }

  const openTasks = await context.entities.Task.findMany({
    where: { userId: user.id, isDone: false },
    select: { description: true },
  });
  const openDescriptions = new Set(
    openTasks.map((task) => task.description.trim().toLowerCase()),
  );
  const toCreate = template.items.filter(
    (item) => !openDescriptions.has(item.description.trim().toLowerCase()),
  );

  const created = await Promise.all(
    toCreate.map((item) =>
      context.entities.Task.create({
        data: {
          user: { connect: { id: user.id } },
          description: item.description,
          time: item.time,
        },
      }),
    ),
  );

  return { created, skipped: template.items.length - created.length };
};

export const getPlanTemplates: GetPlanTemplates<
  void,
  PlanTemplateWithItems[]
> = async (_args, context) => {
  const user = requireUser(context.user);
  return context.entities.PlanTemplate.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { items: { orderBy: { position: "asc" } } },
  });
};

//#endregion
