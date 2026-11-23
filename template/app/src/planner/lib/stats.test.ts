import { describe, expect, it } from "vitest";
import {
  computePeriodStats,
  computeStreak,
  summarizeSteps,
  type StatsStep,
} from "./stats";

function step(overrides: Partial<StatsStep> = {}): StatsStep {
  return {
    taskName: "Write report",
    taskPriority: "medium",
    plannedMinutes: 30,
    actualMinutes: 0,
    isDone: false,
    ...overrides,
  };
}

describe("summarizeSteps", () => {
  it("summarizes an empty plan", () => {
    expect(summarizeSteps([])).toEqual({
      totalSteps: 0,
      doneSteps: 0,
      plannedMinutes: 0,
      completedPlannedMinutes: 0,
      trackedMinutes: 0,
      completionRate: 0,
    });
  });

  it("counts done steps, planned and tracked time", () => {
    const summary = summarizeSteps([
      step({ isDone: true, plannedMinutes: 60, actualMinutes: 50 }),
      step({ plannedMinutes: 30, actualMinutes: 10 }),
      step({ isDone: true, plannedMinutes: 15 }),
      step(),
    ]);
    expect(summary).toEqual({
      totalSteps: 4,
      doneSteps: 2,
      plannedMinutes: 135,
      completedPlannedMinutes: 75,
      trackedMinutes: 60,
      completionRate: 0.5,
    });
  });
});

describe("computePeriodStats", () => {
  const days = ["2026-11-20", "2026-11-21", "2026-11-22"];
  const plans = [
    {
      date: "2026-11-20",
      steps: [
        step({
          taskName: "Emails",
          taskPriority: "high",
          isDone: true,
          plannedMinutes: 30,
          actualMinutes: 45,
        }),
        step({ taskName: "Report", taskPriority: "low", plannedMinutes: 90 }),
      ],
    },
    {
      date: "2026-11-22",
      steps: [
        step({
          taskName: "Emails",
          taskPriority: "high",
          isDone: true,
          plannedMinutes: 30,
          actualMinutes: 15,
        }),
      ],
    },
    // Outside the period: must be ignored.
    { date: "2026-11-01", steps: [step({ isDone: true })] },
  ];

  const stats = computePeriodStats(plans, days);

  it("produces one entry per day, including empty days", () => {
    expect(stats.days.map((day) => day.date)).toEqual(days);
    expect(stats.days.map((day) => day.doneSteps)).toEqual([1, 0, 1]);
    expect(stats.days[1]).toMatchObject({ planCount: 0, totalSteps: 0 });
  });

  it("totals only plans inside the period", () => {
    expect(stats.totals).toMatchObject({
      totalSteps: 3,
      doneSteps: 2,
      plannedMinutes: 150,
      trackedMinutes: 60,
    });
    expect(stats.activeDays).toBe(2);
  });

  it("groups completion by priority, high first", () => {
    expect(stats.byPriority).toEqual([
      { priority: "high", totalSteps: 2, doneSteps: 2, completionRate: 1 },
      { priority: "low", totalSteps: 1, doneSteps: 0, completionRate: 0 },
    ]);
  });

  it("ranks tasks by time", () => {
    expect(stats.topTasks.map((task) => task.taskName)).toEqual([
      "Report",
      "Emails",
    ]);
    expect(stats.topTasks[1]).toMatchObject({
      plannedMinutes: 60,
      trackedMinutes: 60,
      doneSteps: 2,
    });
  });

  it("compares tracked time with estimates for finished steps", () => {
    // 60 tracked minutes for 60 planned minutes of finished, tracked steps.
    expect(stats.estimateRatio).toBe(1);
  });

  it("has no estimate ratio when nothing was tracked", () => {
    expect(
      computePeriodStats([{ date: days[0], steps: [step()] }], days)
        .estimateRatio,
    ).toBeNull();
  });
});

describe("computeStreak", () => {
  it("counts consecutive active days ending today", () => {
    expect(
      computeStreak(["2026-11-20", "2026-11-21", "2026-11-22"], "2026-11-22"),
    ).toBe(3);
  });

  it("keeps yesterday's streak alive if nothing is done yet today", () => {
    expect(computeStreak(["2026-11-20", "2026-11-21"], "2026-11-22")).toBe(2);
  });

  it("breaks on a missed day", () => {
    expect(
      computeStreak(["2026-11-18", "2026-11-19", "2026-11-22"], "2026-11-22"),
    ).toBe(1);
    expect(computeStreak(["2026-11-19"], "2026-11-22")).toBe(0);
    expect(computeStreak([], "2026-11-22")).toBe(0);
  });
});
