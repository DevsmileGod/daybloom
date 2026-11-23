import { describe, expect, it } from "vitest";
import type { GeneratedSchedule } from "../../demo-ai-app/schedule";
import {
  assignStartTimes,
  buildStepsFromSchedule,
  comparePriorities,
  findOverlaps,
  getTotalPlannedMinutes,
  layoutOverlappingSteps,
  moveStep,
  normalizeStartMinute,
} from "./scheduling";

const schedule: GeneratedSchedule = {
  tasks: [
    { name: "Read a book", priority: "low" },
    { name: "Respond to emails", priority: "high" },
    { name: "Write report", priority: "medium" },
  ],
  taskItems: [
    { taskName: "Read a book", description: "Read chapter 1", time: 0.5 },
    { taskName: "Respond to emails", description: "Triage inbox", time: 0.25 },
    { taskName: "Write report", description: "Outline", time: 1 },
    {
      taskName: "Respond to emails",
      description: "Reply to urgent",
      time: 0.5,
    },
    { taskName: "Stretch", description: "Quick stretch", time: 0.01 },
  ],
};

describe("comparePriorities", () => {
  it("orders high before medium before low, unknown last", () => {
    const sorted = ["low", "unknown", "high", "medium"].sort(comparePriorities);
    expect(sorted).toEqual(["high", "medium", "low", "unknown"]);
  });
});

describe("buildStepsFromSchedule", () => {
  const steps = buildStepsFromSchedule(schedule);

  it("orders tasks by priority and keeps each task's steps together", () => {
    expect(steps.map((step) => step.description)).toEqual([
      "Triage inbox",
      "Reply to urgent",
      "Outline",
      "Read chapter 1",
      "Quick stretch",
    ]);
  });

  it("converts hours to minutes with a sensible minimum", () => {
    expect(steps.map((step) => step.plannedMinutes)).toEqual([
      15, 30, 60, 30, 5,
    ]);
  });

  it("keeps steps for tasks the AI forgot to list, as medium priority", () => {
    expect(steps.at(-1)).toMatchObject({
      taskName: "Stretch",
      taskPriority: "medium",
    });
  });

  it("returns nothing for an empty schedule", () => {
    expect(buildStepsFromSchedule({ tasks: [], taskItems: [] })).toEqual([]);
  });
});

describe("assignStartTimes", () => {
  it("lays steps out back to back", () => {
    const scheduled = assignStartTimes(
      [{ plannedMinutes: 30 }, { plannedMinutes: 45 }, { plannedMinutes: 15 }],
      9 * 60,
    );
    expect(scheduled.map((step) => step.startMinute)).toEqual([540, 570, 615]);
    expect(scheduled.map((step) => step.position)).toEqual([0, 1, 2]);
  });

  it("never starts a step after the end of the day", () => {
    const scheduled = assignStartTimes(
      [{ plannedMinutes: 120 }, { plannedMinutes: 120 }],
      23 * 60,
    );
    expect(scheduled.map((step) => step.startMinute)).toEqual([1380, 1439]);
  });
});

describe("moveStep", () => {
  const steps = [
    { id: "a", plannedMinutes: 30, startMinute: 600 },
    { id: "b", plannedMinutes: 60, startMinute: 630 },
    { id: "c", plannedMinutes: 15, startMinute: 690 },
  ];

  it("moves a step and re-flows the day from the first start time", () => {
    const moved = moveStep(steps, "c", 0);
    expect(moved.map((step) => step.id)).toEqual(["c", "a", "b"]);
    expect(moved.map((step) => step.startMinute)).toEqual([600, 615, 645]);
    expect(moved.map((step) => step.position)).toEqual([0, 1, 2]);
  });

  it("clamps target indexes that are out of range", () => {
    expect(moveStep(steps, "a", 99).map((step) => step.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("leaves the order alone for unknown ids", () => {
    expect(moveStep(steps, "zzz", 0).map((step) => step.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("normalizeStartMinute", () => {
  it("snaps to the grid", () => {
    expect(normalizeStartMinute(548, 30)).toBe(555);
    expect(normalizeStartMinute(548, 30, 5)).toBe(550);
  });

  it("keeps the whole step inside the day", () => {
    expect(normalizeStartMinute(1430, 60)).toBe(1380);
    expect(normalizeStartMinute(-10, 30)).toBe(0);
  });
});

describe("overlaps", () => {
  const steps = [
    { id: "a", startMinute: 540, plannedMinutes: 60 },
    { id: "b", startMinute: 570, plannedMinutes: 60 },
    { id: "c", startMinute: 660, plannedMinutes: 30 },
    { id: "d", startMinute: 600, plannedMinutes: 30 },
  ];

  it("finds overlapping pairs but not touching ones", () => {
    expect(findOverlaps(steps)).toEqual([
      ["a", "b"],
      ["b", "d"],
    ]);
  });

  it("assigns side-by-side columns within overlapping clusters", () => {
    const layout = layoutOverlappingSteps(steps);
    const byId = Object.fromEntries(
      layout.map((entry) => [entry.step.id, entry]),
    );
    expect(byId.a).toMatchObject({ column: 0, columnCount: 2 });
    expect(byId.b).toMatchObject({ column: 1, columnCount: 2 });
    // "d" starts when "a" ends, so it can reuse a's column.
    expect(byId.d).toMatchObject({ column: 0, columnCount: 2 });
    expect(byId.c).toMatchObject({ column: 0, columnCount: 1 });
  });

  it("sums planned time", () => {
    expect(getTotalPlannedMinutes(steps)).toBe(180);
  });
});
