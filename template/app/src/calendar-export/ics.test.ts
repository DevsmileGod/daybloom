import { describe, expect, it } from "vitest";
import {
  buildIcsCalendar,
  escapeIcsText,
  foldIcsLine,
  formatIcsUtc,
  getIcsFileName,
  plansToIcsEvents,
} from "./ics";

describe("escapeIcsText", () => {
  it("escapes characters with special meaning", () => {
    expect(escapeIcsText("a, b; c\\d\ne")).toBe("a\\, b\\; c\\\\d\\ne");
  });
});

describe("foldIcsLine", () => {
  const encoder = new TextEncoder();

  it("leaves short lines alone", () => {
    expect(foldIcsLine("SUMMARY:Short")).toBe("SUMMARY:Short");
  });

  it("folds long lines to at most 75 octets each", () => {
    const line = `DESCRIPTION:${"x".repeat(200)}`;
    const folded = foldIcsLine(line);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
    }
    parts.slice(1).forEach((part) => expect(part.startsWith(" ")).toBe(true));
    // Unfolding gives back the original line.
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });

  it("never splits multi-byte characters", () => {
    const line = `SUMMARY:${"🌸".repeat(40)}`;
    const folded = foldIcsLine(line);
    expect(folded.replace(/\r\n /g, "")).toBe(line);
    for (const part of folded.split("\r\n")) {
      expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
    }
  });
});

describe("formatIcsUtc", () => {
  it("formats instants in iCalendar UTC form", () => {
    expect(formatIcsUtc(new Date("2026-11-23T09:30:00.000Z"))).toBe(
      "20261123T093000Z",
    );
  });
});

describe("plansToIcsEvents", () => {
  const plan = {
    id: "plan-1",
    date: "2026-07-01",
    steps: [
      {
        id: "step-1",
        taskName: "Emails",
        taskPriority: "high",
        description: "Triage inbox",
        startMinute: 9 * 60,
        plannedMinutes: 30,
        isDone: false,
      },
    ],
  };

  it("places steps at the right local time", () => {
    const [event] = plansToIcsEvents([plan], "Europe/Berlin");
    expect(event.start.toISOString()).toBe("2026-07-01T07:00:00.000Z");
    expect(event.end.toISOString()).toBe("2026-07-01T07:30:00.000Z");
    expect(event.uid).toBe("step-1@daybloom.app");
    expect(event.summary).toBe("Triage inbox");
    expect(event.description).toBe("Emails (high priority)");
  });
});

describe("buildIcsCalendar", () => {
  const ics = buildIcsCalendar({
    name: "Daybloom",
    refreshIntervalMinutes: 60,
    events: [
      {
        uid: "step-1@daybloom.app",
        start: new Date("2026-11-23T09:00:00Z"),
        end: new Date("2026-11-23T09:30:00Z"),
        summary: "Plan, then do",
        description: "Line one\nLine two",
        isDone: true,
      },
    ],
  });

  it("produces a well-formed calendar with CRLF line endings", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/\n/);
  });

  it("includes event details, escaped", () => {
    expect(ics).toContain("UID:step-1@daybloom.app");
    expect(ics).toContain("DTSTART:20261123T090000Z");
    expect(ics).toContain("DTEND:20261123T093000Z");
    expect(ics).toContain("SUMMARY:✓ Plan\\, then do");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two");
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT60M");
  });

  it("balances BEGIN and END blocks", () => {
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics.match(/END:VEVENT/g)).toHaveLength(1);
  });
});

describe("getIcsFileName", () => {
  it("includes the date", () => {
    expect(getIcsFileName("2026-11-23")).toBe("daybloom-2026-11-23.ics");
  });
});
