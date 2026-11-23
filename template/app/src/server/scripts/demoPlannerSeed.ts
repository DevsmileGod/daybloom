import type { PrismaClient } from "@prisma/client";
import {
  addDaysToDateKey,
  getDayOfWeek,
  getTodayDateKey,
  isValidTimeZone,
  type DateKey,
} from "../../planner/lib/dates";

type DemoStep = {
  taskName: string;
  taskPriority: "low" | "medium" | "high";
  description: string;
  plannedMinutes: number;
};

const DEMO_TASKS: { description: string; time: string }[] = [
  { description: "Write the weekly report", time: "1.5" },
  { description: "Review open pull requests", time: "1" },
  { description: "Prepare slides for Thursday's demo", time: "2" },
  { description: "Reply to customer emails", time: "0.5" },
  { description: "Plan next sprint", time: "1" },
];

const STEP_POOL: DemoStep[] = [
  {
    taskName: "Write the weekly report",
    taskPriority: "high",
    description: "Collect numbers from the dashboard",
    plannedMinutes: 30,
  },
  {
    taskName: "Write the weekly report",
    taskPriority: "high",
    description: "Draft the summary and highlights",
    plannedMinutes: 45,
  },
  {
    taskName: "Review open pull requests",
    taskPriority: "medium",
    description: "Review the two oldest PRs",
    plannedMinutes: 40,
  },
  {
    taskName: "Reply to customer emails",
    taskPriority: "medium",
    description: "Answer support emails from yesterday",
    plannedMinutes: 25,
  },
  {
    taskName: "Prepare slides for the demo",
    taskPriority: "high",
    description: "Outline the story and key screens",
    plannedMinutes: 35,
  },
  {
    taskName: "Prepare slides for the demo",
    taskPriority: "high",
    description: "Build the slides and rehearse once",
    plannedMinutes: 60,
  },
  {
    taskName: "Plan next sprint",
    taskPriority: "medium",
    description: "Groom the backlog and estimate",
    plannedMinutes: 45,
  },
  {
    taskName: "Fix flaky login test",
    taskPriority: "low",
    description: "Reproduce locally and add a retry guard",
    plannedMinutes: 30,
  },
  {
    taskName: "Update documentation",
    taskPriority: "low",
    description: "Document the new settings page",
    plannedMinutes: 25,
  },
  {
    taskName: "Team standup",
    taskPriority: "medium",
    description: "Share progress and blockers",
    plannedMinutes: 15,
  },
];

const PAST_DAYS = 13;
const WORKDAY_START_MINUTE = 9 * 60;
const BREAK_MINUTES = 10;

/**
 * Fills one account with demo planner data (tasks, two weeks of plans with
 * progress, and routines) so every page has something to show.
 *
 * Run with `wasp db seed seedDemoPlanner`. Set `SEED_USER_EMAIL` to pick the
 * account, otherwise the most recently created user is used. Accounts that
 * already have plans are left alone.
 */
export async function seedDemoPlanner(prismaClient: PrismaClient) {
  const email = process.env.SEED_USER_EMAIL?.trim().toLowerCase();
  const user = email
    ? await prismaClient.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
      })
    : await prismaClient.user.findFirst({ orderBy: { createdAt: "desc" } });

  if (!user) {
    console.log(
      email
        ? `No user with email ${email}. Sign up in the app first.`
        : "No users yet. Sign up in the app first.",
    );
    return;
  }

  const existingPlans = await prismaClient.plan.count({
    where: { userId: user.id },
  });
  if (existingPlans > 0) {
    console.log(
      `${user.email ?? user.id} already has ${existingPlans} plan(s), skipping demo data.`,
    );
    return;
  }

  const timeZone = isValidTimeZone(user.timeZone) ? user.timeZone : "UTC";
  const today = getTodayDateKey(timeZone);
  const random = createRandom(hashString(user.id));

  await prismaClient.task.createMany({
    data: DEMO_TASKS.map((task) => ({ ...task, userId: user.id })),
  });

  for (let offset = -PAST_DAYS; offset <= 0; offset++) {
    const date = addDaysToDateKey(today, offset);
    const isWeekend = [0, 6].includes(getDayOfWeek(date));
    if (isWeekend && random() < 0.7) continue;

    const steps = pickSteps(
      random,
      isWeekend ? 3 : 4 + Math.floor(random() * 3),
    );
    const isToday = offset === 0;
    const doneChance = isToday ? 0.35 : 0.8;

    let startMinute = WORKDAY_START_MINUTE;
    const stepData = steps.map((step, position) => {
      const isDone = random() < doneChance;
      const actualMinutes = isDone
        ? Math.max(5, Math.round(step.plannedMinutes * (0.7 + random() * 0.7)))
        : 0;
      const data = {
        ...step,
        position,
        startMinute,
        isDone,
        actualMinutes,
        completedAt: isDone ? dateKeyToNoonUtc(date) : null,
      };
      startMinute += step.plannedMinutes + BREAK_MINUTES;
      return data;
    });

    await prismaClient.plan.create({
      data: {
        userId: user.id,
        date,
        hours:
          Math.round(
            (stepData.reduce((sum, s) => sum + s.plannedMinutes, 0) / 60) * 2,
          ) / 2 || 1,
        note: isToday ? "Focus on the report before lunch." : null,
        steps: { create: stepData },
      },
    });
  }

  await prismaClient.recurringTask.createMany({
    data: [
      {
        userId: user.id,
        description: "Team standup",
        time: "0.25",
        frequency: "weekdays",
        daysOfWeek: [],
      },
      {
        userId: user.id,
        description: "Weekly review",
        time: "1",
        frequency: "weekly",
        daysOfWeek: [5],
      },
    ],
  });

  console.log(`Added demo planner data for ${user.email ?? user.id}.`);
}

function pickSteps(random: () => number, count: number): DemoStep[] {
  const pool = [...STEP_POOL];
  const picked: DemoStep[] = [];
  while (picked.length < count && pool.length > 0) {
    picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return picked.sort(
    (a, b) => priorityOrder[a.taskPriority] - priorityOrder[b.taskPriority],
  );
}

function dateKeyToNoonUtc(date: DateKey): Date {
  return new Date(`${date}T12:00:00Z`);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

/** Small seeded PRNG (mulberry32) so the demo data is stable per user. */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
