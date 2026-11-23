import { describe, expect, it } from "vitest";
import {
  clamp,
  formatDuration,
  formatMinutesAsClock,
  hoursStringToMinutes,
  minutesBetween,
  parseClock,
  snapMinutes,
} from "./time";

describe("formatMinutesAsClock", () => {
  it("formats minutes after midnight as HH:MM", () => {
    expect(formatMinutesAsClock(0)).toBe("00:00");
    expect(formatMinutesAsClock(570)).toBe("09:30");
    expect(formatMinutesAsClock(1439)).toBe("23:59");
  });

  it("wraps values outside a single day", () => {
    expect(formatMinutesAsClock(1440)).toBe("00:00");
    expect(formatMinutesAsClock(-30)).toBe("23:30");
  });
});

describe("parseClock", () => {
  it("parses valid times", () => {
    expect(parseClock("09:30")).toBe(570);
    expect(parseClock("9:05")).toBe(545);
    expect(parseClock(" 23:59 ")).toBe(1439);
    expect(parseClock("00:00")).toBe(0);
  });

  it("rejects invalid times", () => {
    expect(parseClock("24:00")).toBeNull();
    expect(parseClock("12:60")).toBeNull();
    expect(parseClock("noon")).toBeNull();
    expect(parseClock("")).toBeNull();
  });

  it("round-trips with formatMinutesAsClock", () => {
    for (const minute of [0, 1, 59, 60, 545, 1439]) {
      expect(parseClock(formatMinutesAsClock(minute))).toBe(minute);
    }
  });
});

describe("formatDuration", () => {
  it("uses the shortest readable form", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(30)).toBe("30m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(95)).toBe("1h 35m");
    expect(formatDuration(120)).toBe("2h");
  });

  it("never shows negative durations", () => {
    expect(formatDuration(-5)).toBe("0m");
  });
});

describe("hoursStringToMinutes", () => {
  it("converts hour strings from the task form", () => {
    expect(hoursStringToMinutes("1")).toBe(60);
    expect(hoursStringToMinutes("1.5")).toBe(90);
    expect(hoursStringToMinutes("0.25")).toBe(15);
  });

  it("treats invalid or non-positive values as zero", () => {
    expect(hoursStringToMinutes("abc")).toBe(0);
    expect(hoursStringToMinutes("-1")).toBe(0);
    expect(hoursStringToMinutes("")).toBe(0);
  });
});

describe("small numeric helpers", () => {
  it("snaps to the nearest grid step", () => {
    expect(snapMinutes(37)).toBe(30);
    expect(snapMinutes(38)).toBe(45);
    expect(snapMinutes(52, 5)).toBe(50);
  });

  it("clamps into a range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("counts whole minutes between instants", () => {
    const start = new Date("2026-11-22T09:00:00Z");
    expect(minutesBetween(start, new Date("2026-11-22T09:44:40Z"))).toBe(45);
    expect(minutesBetween(start, new Date("2026-11-22T08:00:00Z"))).toBe(0);
  });
});
