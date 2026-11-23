import { describe, expect, it } from "vitest";
import {
  describeRecurrence,
  isRecurrenceFrequency,
  isRecurringTaskDueOn,
  normalizeDaysOfWeek,
  validateRecurrenceRule,
} from "./recurrence";

// 2026-11-22 is a Sunday, 2026-11-23 a Monday, 2026-11-28 a Saturday.
const SUNDAY = "2026-11-22";
const MONDAY = "2026-11-23";
const WEDNESDAY = "2026-11-25";
const SATURDAY = "2026-11-28";

describe("isRecurringTaskDueOn", () => {
  it("daily tasks are due every day", () => {
    for (const day of [SUNDAY, MONDAY, WEDNESDAY, SATURDAY]) {
      expect(isRecurringTaskDueOn({ frequency: "daily", daysOfWeek: [] }, day)).toBe(true);
    }
  });

  it("weekday tasks skip weekends", () => {
    const rule = { frequency: "weekdays", daysOfWeek: [] };
    expect(isRecurringTaskDueOn(rule, MONDAY)).toBe(true);
    expect(isRecurringTaskDueOn(rule, WEDNESDAY)).toBe(true);
    expect(isRecurringTaskDueOn(rule, SATURDAY)).toBe(false);
    expect(isRecurringTaskDueOn(rule, SUNDAY)).toBe(false);
  });

  it("weekly tasks are due on the chosen days only", () => {
    const rule = { frequency: "weekly", daysOfWeek: [1, 3] };
    expect(isRecurringTaskDueOn(rule, MONDAY)).toBe(true);
    expect(isRecurringTaskDueOn(rule, WEDNESDAY)).toBe(true);
    expect(isRecurringTaskDueOn(rule, SUNDAY)).toBe(false);
  });

  it("unknown frequencies are never due", () => {
    expect(isRecurringTaskDueOn({ frequency: "hourly", daysOfWeek: [] }, MONDAY)).toBe(false);
  });
});

describe("normalizeDaysOfWeek", () => {
  it("dedupes, sorts and drops invalid days", () => {
    expect(normalizeDaysOfWeek([5, 1, 1, 7, -1, 2.5, 0])).toEqual([0, 1, 5]);
  });
});

describe("describeRecurrence", () => {
  it("describes each frequency", () => {
    expect(describeRecurrence({ frequency: "daily", daysOfWeek: [] })).toBe("Every day");
    expect(describeRecurrence({ frequency: "weekdays", daysOfWeek: [] })).toBe("Every weekday");
    expect(describeRecurrence({ frequency: "weekly", daysOfWeek: [5, 1, 3] })).toBe(
      "Every Mon, Wed, Fri",
    );
  });

  it("lists Sunday last, the way people read a week", () => {
    expect(describeRecurrence({ frequency: "weekly", daysOfWeek: [0, 6] })).toBe(
      "Every Sat, Sun",
    );
  });

  it("collapses all seven days to every day", () => {
    expect(
      describeRecurrence({ frequency: "weekly", daysOfWeek: [0, 1, 2, 3, 4, 5, 6] }),
    ).toBe("Every day");
  });
});

describe("validation", () => {
  it("recognizes frequencies", () => {
    expect(isRecurrenceFrequency("weekly")).toBe(true);
    expect(isRecurrenceFrequency("monthly")).toBe(false);
  });

  it("requires days for weekly tasks", () => {
    expect(validateRecurrenceRule({ frequency: "weekly", daysOfWeek: [] })).toMatch(
      /at least one day/,
    );
    expect(validateRecurrenceRule({ frequency: "weekly", daysOfWeek: [2] })).toBeNull();
    expect(validateRecurrenceRule({ frequency: "daily", daysOfWeek: [] })).toBeNull();
    expect(validateRecurrenceRule({ frequency: "yearly", daysOfWeek: [] })).toMatch(
      /Unknown frequency/,
    );
  });
});
