import { describe, expect, it } from "vitest";
import {
  addDaysToDateKey,
  compareDateKeys,
  diffInDays,
  formatDateKey,
  getDateKeyRange,
  getDayOfWeek,
  getLocalDateKey,
  getLocalMinuteOfDay,
  getTimeZoneOffsetMinutes,
  getWeekDateKeys,
  isValidDateKey,
  isValidTimeZone,
  localDateTimeToInstant,
} from "./dates";

describe("isValidDateKey", () => {
  it("accepts real calendar days", () => {
    expect(isValidDateKey("2026-11-22")).toBe(true);
    expect(isValidDateKey("2024-02-29")).toBe(true);
  });

  it("rejects impossible days and other formats", () => {
    expect(isValidDateKey("2026-02-29")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(isValidDateKey("2026-04-31")).toBe(false);
    expect(isValidDateKey("2026-1-01")).toBe(false);
    expect(isValidDateKey("22.11.2026")).toBe(false);
    expect(isValidDateKey("")).toBe(false);
  });
});

describe("date key arithmetic", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDaysToDateKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDateKey("2024-03-01", -1)).toBe("2024-02-29");
    expect(addDaysToDateKey("2026-11-22", 0)).toBe("2026-11-22");
    expect(addDaysToDateKey("2026-11-22", -365)).toBe("2025-11-22");
  });

  it("computes the day of week", () => {
    expect(getDayOfWeek("2026-11-22")).toBe(0); // Sunday
    expect(getDayOfWeek("2026-11-23")).toBe(1); // Monday
    expect(getDayOfWeek("2026-11-28")).toBe(6); // Saturday
  });

  it("compares and diffs date keys", () => {
    expect(compareDateKeys("2026-11-01", "2026-11-22")).toBe(-1);
    expect(compareDateKeys("2026-11-22", "2026-11-22")).toBe(0);
    expect(compareDateKeys("2027-01-01", "2026-12-31")).toBe(1);
    expect(diffInDays("2026-11-01", "2026-11-22")).toBe(21);
    expect(diffInDays("2026-11-22", "2026-11-01")).toBe(-21);
  });

  it("throws on invalid input instead of producing garbage", () => {
    expect(() => addDaysToDateKey("not-a-date", 1)).toThrow();
  });
});

describe("week and range helpers", () => {
  it("returns a Monday-first week by default", () => {
    expect(getWeekDateKeys("2026-11-22")).toEqual([
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ]);
  });

  it("supports Sunday-first weeks", () => {
    const week = getWeekDateKeys("2026-11-22", 0);
    expect(week[0]).toBe("2026-11-22");
    expect(week[6]).toBe("2026-11-28");
  });

  it("builds inclusive ranges and handles reversed ranges", () => {
    expect(getDateKeyRange("2026-11-20", "2026-11-22")).toEqual([
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ]);
    expect(getDateKeyRange("2026-11-22", "2026-11-22")).toEqual(["2026-11-22"]);
    expect(getDateKeyRange("2026-11-22", "2026-11-20")).toEqual([]);
  });
});

describe("time zone helpers", () => {
  const lateEveningUtc = new Date("2026-11-22T23:30:00Z");

  it("finds the local calendar day", () => {
    expect(getLocalDateKey(lateEveningUtc, "UTC")).toBe("2026-11-22");
    expect(getLocalDateKey(lateEveningUtc, "Asia/Tokyo")).toBe("2026-11-23");
    expect(getLocalDateKey(lateEveningUtc, "America/New_York")).toBe(
      "2026-11-22",
    );
  });

  it("finds the local minute of day", () => {
    expect(getLocalMinuteOfDay(lateEveningUtc, "UTC")).toBe(23 * 60 + 30);
    expect(getLocalMinuteOfDay(lateEveningUtc, "Asia/Tokyo")).toBe(8 * 60 + 30);
  });

  it("reports offsets including daylight saving time", () => {
    expect(
      getTimeZoneOffsetMinutes(
        new Date("2026-07-01T12:00:00Z"),
        "Europe/Berlin",
      ),
    ).toBe(120);
    expect(
      getTimeZoneOffsetMinutes(
        new Date("2026-01-15T12:00:00Z"),
        "Europe/Berlin",
      ),
    ).toBe(60);
    expect(
      getTimeZoneOffsetMinutes(new Date("2026-01-15T12:00:00Z"), "UTC"),
    ).toBe(0);
  });

  it("converts local wall-clock times to instants", () => {
    expect(
      localDateTimeToInstant(
        "2026-07-01",
        9 * 60,
        "Europe/Berlin",
      ).toISOString(),
    ).toBe("2026-07-01T07:00:00.000Z");
    expect(
      localDateTimeToInstant(
        "2026-01-15",
        9 * 60,
        "America/New_York",
      ).toISOString(),
    ).toBe("2026-01-15T14:00:00.000Z");
  });

  it("handles the day daylight saving time starts", () => {
    // US clocks jump forward at 02:00 on 2026-03-08; 10:00 is already EDT.
    expect(
      localDateTimeToInstant(
        "2026-03-08",
        10 * 60,
        "America/New_York",
      ).toISOString(),
    ).toBe("2026-03-08T14:00:00.000Z");
  });

  it("validates time zone names", () => {
    expect(isValidTimeZone("Europe/Berlin")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
  });
});

describe("formatDateKey", () => {
  it("formats independently of the runtime time zone", () => {
    expect(formatDateKey("2026-11-22", { weekday: "long" }, "en-US")).toBe(
      "Sunday",
    );
    expect(
      formatDateKey(
        "2026-01-01",
        { year: "numeric", month: "long", day: "numeric" },
        "en-US",
      ),
    ).toBe("January 1, 2026");
  });
});
