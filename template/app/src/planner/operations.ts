import type { PlanStep } from "wasp/entities";
import { HttpError, type PrismaClient } from "wasp/server";
import type {
  AddPlanStep,
  DeletePlan,
  DeletePlanStep,
  DuplicatePlanToDate,
  GeneratePlan,
  GetPlanById,
  GetPlanForDate,
  GetPlannerStats,
  GetPlans,
  GetPlansInRange,
  ReorderPlanStep,
  StartStepTimer,
  StopStepTimer,
  UpdatePlanNote,
  UpdatePlanStep,
} from "wasp/server/operations";
import * as z from "zod";
import { generateScheduleWithGpt } from "../demo-ai-app/gpt";
import { withCreditCharge } from "../payment/credits";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import {
  addDaysToDateKey,
  diffInDays,
  getDateKeyRange,
  getLocalDateKey,
  isValidDateKey,
} from "./lib/dates";
import {
  assignStartTimes,
  buildStepsFromSchedule,
  moveStep,
  normalizeStartMinute,
} from "./lib/scheduling";
import { computePeriodStats, computeStreak, summarizeSteps } from "./lib/stats";
import { MINUTES_PER_DAY, minutesBetween } from "./lib/time";
import type { PlanListPage, PlannerStats, PlanWithSteps } from "./types";

const MAX_RANGE_DAYS = 92;
const MAX_STEPS_PER_PLAN = 100;

const dateKeySchema = z
  .string()
  .refine(isValidDateKey, { message: "Expected a date in YYYY-MM-DD format" });
const idSchema = z.string().nonempty();
const minuteOfDaySchema = z
  .number()
  .int()
  .min(0)
  .max(MINUTES_PER_DAY - 1);
const durationSchema = z.number().int().min(1).max(MINUTES_PER_DAY);

const stepsOrderBy = { orderBy: { position: "asc" } } as const;
const insensitive = "insensitive" as const;

function requireUser<T>(user: T | undefined): T {
  if (!user) {
    throw new HttpError(401, "You need to be logged in to do that");
  }
  return user;
}

type PlanStepDelegate = PrismaClient["planStep"];

/**
 * Finds a step that belongs to one of the user's plans, or throws 404.
 * Used before every step mutation so users can't touch other users' plans.
 */
async function findOwnedStep(
  planStepDelegate: PlanStepDelegate,
  stepId: string,
  userId: string,
): Promise<PlanStep> {
  const step = await planStepDelegate.findFirst({
    where: { id: stepId, plan: { userId } },
  });
  if (!step) {
    throw new HttpError(404, "Step not found");
  }
  return step;
}

/** Adds the time since `timerStartedAt` to the step's tracked minutes. */
function stoppedTimerData(step: PlanStep, now: Date) {
  if (!step.timerStartedAt) return {};
  return {
    timerStartedAt: null,
    actualMinutes:
      step.actualMinutes + minutesBetween(step.timerStartedAt, now),
  };
}

//#region Actions

const generatePlanInputSchema = z.object({
  date: dateKeySchema,
  hours: z.number().min(0.5).max(24),
  startMinute: minuteOfDaySchema.optional(),
  /** When regenerating: the plan to delete once the new one is saved. */
  replacePlanId: idSchema.optional(),
});

/**
 * Generates a new AI plan for `date` from the user's open tasks.
 * Costs one credit for users without a subscription.
 */
export const generatePlan: GeneratePlan<
  z.infer<typeof generatePlanInputSchema>,
  PlanWithSteps
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { date, hours, startMinute, replacePlanId } =
    ensureArgsSchemaOrThrowHttpError(generatePlanInputSchema, rawArgs);

  if (replacePlanId) {
    const planToReplace = await context.entities.Plan.findFirst({
      where: { id: replacePlanId, userId: user.id },
      select: { id: true },
    });
    if (!planToReplace) {
      throw new HttpError(404, "The plan to replace was not found");
    }
  }

  const openTasks = await context.entities.Task.findMany({
    where: { userId: user.id, isDone: false },
    orderBy: { createdAt: "asc" },
  });
  if (openTasks.length === 0) {
    throw new HttpError(400, "Add at least one open task before planning");
  }

  return withCreditCharge(user, context.entities.User, async () => {
    const schedule = await generateScheduleWithGpt(openTasks, hours);
    if (schedule === null) {
      throw new HttpError(
        500,
        "Encountered a problem in communication with OpenAI",
      );
    }

    const steps = assignStartTimes(
      buildStepsFromSchedule(schedule).slice(0, MAX_STEPS_PER_PLAN),
      startMinute ?? user.workdayStartMinutes,
    );
    if (steps.length === 0) {
      throw new HttpError(500, "The AI returned an empty plan. Try again.");
    }

    const plan = await context.entities.Plan.create({
      data: {
        user: { connect: { id: user.id } },
        date,
        hours,
        steps: { create: steps },
      },
      include: { steps: stepsOrderBy },
    });

    // Delete the old plan only after the new one is safely saved, so a
    // failed generation never leaves the user without a plan.
    if (replacePlanId) {
      await context.entities.Plan.deleteMany({
        where: { id: replacePlanId, userId: user.id },
      });
    }

    return plan;
  });
};

const duplicatePlanInputSchema = z.object({
  planId: idSchema,
  date: dateKeySchema,
});

/** Copies a plan's steps to another day with progress reset. Free. */
export const duplicatePlanToDate: DuplicatePlanToDate<
  z.infer<typeof duplicatePlanInputSchema>,
  PlanWithSteps
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { planId, date } = ensureArgsSchemaOrThrowHttpError(
    duplicatePlanInputSchema,
    rawArgs,
  );

  const source = await context.entities.Plan.findFirst({
    where: { id: planId, userId: user.id },
    include: { steps: stepsOrderBy },
  });
  if (!source) {
    throw new HttpError(404, "Plan not found");
  }

  return context.entities.Plan.create({
    data: {
      user: { connect: { id: user.id } },
      date,
      hours: source.hours,
      note: source.note,
      steps: {
        create: source.steps.map((step) => ({
          taskName: step.taskName,
          taskPriority: step.taskPriority,
          description: step.description,
          position: step.position,
          startMinute: step.startMinute,
          plannedMinutes: step.plannedMinutes,
        })),
      },
    },
    include: { steps: stepsOrderBy },
  });
};

const updatePlanStepInputSchema = z.object({
  id: idSchema,
  isDone: z.boolean().optional(),
  description: z.string().trim().min(1).max(500).optional(),
  plannedMinutes: durationSchema.optional(),
  startMinute: minuteOfDaySchema.optional(),
});

export const updatePlanStep: UpdatePlanStep<
  z.infer<typeof updatePlanStepInputSchema>,
  PlanStep
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { id, isDone, description, plannedMinutes, startMinute } =
    ensureArgsSchemaOrThrowHttpError(updatePlanStepInputSchema, rawArgs);

  const step = await findOwnedStep(context.entities.PlanStep, id, user.id);
  const now = new Date();
  const nextPlannedMinutes = plannedMinutes ?? step.plannedMinutes;

  return context.entities.PlanStep.update({
    where: { id: step.id },
    data: {
      description,
      plannedMinutes,
      startMinute:
        startMinute === undefined
          ? undefined
          : normalizeStartMinute(startMinute, nextPlannedMinutes, 5),
      ...(isDone === undefined
        ? {}
        : {
            isDone,
            completedAt: isDone ? now : null,
            // Finishing a step stops its timer.
            ...(isDone ? stoppedTimerData(step, now) : {}),
          }),
    },
  });
};

const reorderPlanStepInputSchema = z.object({
  id: idSchema,
  toIndex: z.number().int().min(0),
});

/**
 * Moves a step to a new position and re-flows the day so steps stay back to
 * back. Returns all steps of the plan in their new order.
 */
export const reorderPlanStep: ReorderPlanStep<
  z.infer<typeof reorderPlanStepInputSchema>,
  PlanStep[]
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { id, toIndex } = ensureArgsSchemaOrThrowHttpError(
    reorderPlanStepInputSchema,
    rawArgs,
  );

  const step = await findOwnedStep(context.entities.PlanStep, id, user.id);
  const steps = await context.entities.PlanStep.findMany({
    where: { planId: step.planId },
    ...stepsOrderBy,
  });
  const reordered = moveStep(steps, id, toIndex);

  // Wasp doesn't expose `$transaction` on entity delegates, so we update each
  // step on its own. Positions are recomputed from scratch on every reorder,
  // so a partial failure is fixed by the next successful reorder.
  return Promise.all(
    reordered.map((reorderedStep) =>
      context.entities.PlanStep.update({
        where: { id: reorderedStep.id },
        data: {
          position: reorderedStep.position,
          startMinute: reorderedStep.startMinute,
        },
      }),
    ),
  ).then((updated) => updated.sort((a, b) => a.position - b.position));
};

const addPlanStepInputSchema = z.object({
  planId: idSchema,
  description: z.string().trim().min(1).max(500),
  taskName: z.string().trim().min(1).max(200).optional(),
  taskPriority: z.enum(["low", "medium", "high"]).optional(),
  plannedMinutes: durationSchema,
  startMinute: minuteOfDaySchema.optional(),
});

/** Adds a manual step. Without `startMinute` it goes right after the last step. */
export const addPlanStep: AddPlanStep<
  z.infer<typeof addPlanStepInputSchema>,
  PlanStep
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const args = ensureArgsSchemaOrThrowHttpError(
    addPlanStepInputSchema,
    rawArgs,
  );

  const plan = await context.entities.Plan.findFirst({
    where: { id: args.planId, userId: user.id },
    include: { steps: stepsOrderBy },
  });
  if (!plan) {
    throw new HttpError(404, "Plan not found");
  }
  if (plan.steps.length >= MAX_STEPS_PER_PLAN) {
    throw new HttpError(
      400,
      `A plan can have at most ${MAX_STEPS_PER_PLAN} steps`,
    );
  }

  const lastStep = plan.steps.at(-1);
  const defaultStart = lastStep
    ? lastStep.startMinute + lastStep.plannedMinutes
    : user.workdayStartMinutes;

  return context.entities.PlanStep.create({
    data: {
      plan: { connect: { id: plan.id } },
      description: args.description,
      taskName: args.taskName ?? "Extra",
      taskPriority: args.taskPriority ?? "medium",
      plannedMinutes: args.plannedMinutes,
      position: plan.steps.length,
      startMinute: normalizeStartMinute(
        args.startMinute ?? defaultStart,
        args.plannedMinutes,
        5,
      ),
    },
  });
};

export const deletePlanStep: DeletePlanStep<{ id: string }, PlanStep> = async (
  rawArgs,
  context,
) => {
  const user = requireUser(context.user);
  const { id } = ensureArgsSchemaOrThrowHttpError(
    z.object({ id: idSchema }),
    rawArgs,
  );
  const step = await findOwnedStep(context.entities.PlanStep, id, user.id);
  return context.entities.PlanStep.delete({ where: { id: step.id } });
};

export const startStepTimer: StartStepTimer<{ id: string }, PlanStep> = async (
  rawArgs,
  context,
) => {
  const user = requireUser(context.user);
  const { id } = ensureArgsSchemaOrThrowHttpError(
    z.object({ id: idSchema }),
    rawArgs,
  );
  const step = await findOwnedStep(context.entities.PlanStep, id, user.id);
  if (step.timerStartedAt) {
    return step;
  }

  // Only one timer runs at a time: stop any other running timer first.
  const now = new Date();
  const runningSteps = await context.entities.PlanStep.findMany({
    where: {
      plan: { userId: user.id },
      timerStartedAt: { not: null },
      id: { not: step.id },
    },
  });
  await Promise.all(
    runningSteps.map((runningStep) =>
      context.entities.PlanStep.update({
        where: { id: runningStep.id },
        data: stoppedTimerData(runningStep, now),
      }),
    ),
  );

  return context.entities.PlanStep.update({
    where: { id: step.id },
    data: { timerStartedAt: now },
  });
};

export const stopStepTimer: StopStepTimer<{ id: string }, PlanStep> = async (
  rawArgs,
  context,
) => {
  const user = requireUser(context.user);
  const { id } = ensureArgsSchemaOrThrowHttpError(
    z.object({ id: idSchema }),
    rawArgs,
  );
  const step = await findOwnedStep(context.entities.PlanStep, id, user.id);
  if (!step.timerStartedAt) {
    return step;
  }
  return context.entities.PlanStep.update({
    where: { id: step.id },
    data: stoppedTimerData(step, new Date()),
  });
};

const updatePlanNoteInputSchema = z.object({
  id: idSchema,
  note: z.string().max(2000),
});

export const updatePlanNote: UpdatePlanNote<
  z.infer<typeof updatePlanNoteInputSchema>,
  PlanWithSteps
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { id, note } = ensureArgsSchemaOrThrowHttpError(
    updatePlanNoteInputSchema,
    rawArgs,
  );
  const plan = await context.entities.Plan.findFirst({
    where: { id, userId: user.id },
  });
  if (!plan) {
    throw new HttpError(404, "Plan not found");
  }
  return context.entities.Plan.update({
    where: { id: plan.id },
    data: { note: note.trim() === "" ? null : note.trim() },
    include: { steps: stepsOrderBy },
  });
};

export const deletePlan: DeletePlan<{ id: string }, { id: string }> = async (
  rawArgs,
  context,
) => {
  const user = requireUser(context.user);
  const { id } = ensureArgsSchemaOrThrowHttpError(
    z.object({ id: idSchema }),
    rawArgs,
  );
  const { count } = await context.entities.Plan.deleteMany({
    where: { id, userId: user.id },
  });
  if (count === 0) {
    throw new HttpError(404, "Plan not found");
  }
  return { id };
};

//#endregion

//#region Queries

/** The most recent plan for a day, or null if the day has no plan yet. */
export const getPlanForDate: GetPlanForDate<
  { date: string },
  PlanWithSteps | null
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { date } = ensureArgsSchemaOrThrowHttpError(
    z.object({ date: dateKeySchema }),
    rawArgs,
  );
  return context.entities.Plan.findFirst({
    where: { userId: user.id, date },
    orderBy: { createdAt: "desc" },
    include: { steps: stepsOrderBy },
  });
};

export const getPlanById: GetPlanById<{ id: string }, PlanWithSteps> = async (
  rawArgs,
  context,
) => {
  const user = requireUser(context.user);
  const { id } = ensureArgsSchemaOrThrowHttpError(
    z.object({ id: idSchema }),
    rawArgs,
  );
  const plan = await context.entities.Plan.findFirst({
    where: { id, userId: user.id },
    include: { steps: stepsOrderBy },
  });
  if (!plan) {
    throw new HttpError(404, "Plan not found");
  }
  return plan;
};

const getPlansInputSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
  search: z.string().trim().max(200).optional(),
});

/** Plan history, newest day first, paginated with a cursor. */
export const getPlans: GetPlans<
  z.input<typeof getPlansInputSchema>,
  PlanListPage
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { cursor, limit, search } = ensureArgsSchemaOrThrowHttpError(
    getPlansInputSchema,
    rawArgs ?? {},
  );

  const plans = await context.entities.Plan.findMany({
    where: {
      userId: user.id,
      ...(search
        ? {
            OR: [
              { note: { contains: search, mode: insensitive } },
              {
                steps: {
                  some: {
                    OR: [
                      { taskName: { contains: search, mode: insensitive } },
                      {
                        description: { contains: search, mode: insensitive },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { steps: stepsOrderBy },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = plans.length > limit;
  const page = hasMore ? plans.slice(0, limit) : plans;

  return {
    plans: page.map(({ steps, ...plan }) => ({
      ...plan,
      summary: summarizeSteps(steps),
      taskNames: [...new Set(steps.map((step) => step.taskName))],
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
};

const rangeInputSchema = z
  .object({ from: dateKeySchema, to: dateKeySchema })
  .refine(({ from, to }) => diffInDays(from, to) >= 0, {
    message: "`from` must not be after `to`",
  })
  .refine(({ from, to }) => diffInDays(from, to) < MAX_RANGE_DAYS, {
    message: `The range can span at most ${MAX_RANGE_DAYS} days`,
  });

/** All plans between two days (inclusive), e.g. for the calendar week view. */
export const getPlansInRange: GetPlansInRange<
  z.infer<typeof rangeInputSchema>,
  PlanWithSteps[]
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { from, to } = ensureArgsSchemaOrThrowHttpError(
    rangeInputSchema,
    rawArgs,
  );
  return context.entities.Plan.findMany({
    where: { userId: user.id, date: { gte: from, lte: to } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: { steps: stepsOrderBy },
  });
};

/** Progress statistics for a period, plus the current streak. */
export const getPlannerStats: GetPlannerStats<
  z.infer<typeof rangeInputSchema>,
  PlannerStats
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { from, to } = ensureArgsSchemaOrThrowHttpError(
    rangeInputSchema,
    rawArgs,
  );
  const today = getLocalDateKey(new Date(), user.timeZone);

  const plans = await context.entities.Plan.findMany({
    where: { userId: user.id, date: { gte: from, lte: to } },
    include: { steps: true },
  });
  const stats = computePeriodStats(plans, getDateKeyRange(from, to));

  // The streak can reach back before the period, so look at recent days with
  // finished steps separately.
  const streakWindowStart = addDaysToDateKey(today, -365);
  const activePlans = await context.entities.Plan.findMany({
    where: {
      userId: user.id,
      date: { gte: streakWindowStart, lte: today },
      steps: { some: { isDone: true } },
    },
    select: { date: true },
  });

  return {
    ...stats,
    from,
    to,
    today,
    streak: computeStreak(
      activePlans.map((plan) => plan.date),
      today,
    ),
  };
};

//#endregion
