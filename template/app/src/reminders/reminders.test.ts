import { describe, expect, it } from "vitest";
import {
  buildReminderEmail,
  escapeHtml,
  selectStepsToRemind,
  type RemindableStep,
} from "./reminders";

function step(overrides: Partial<RemindableStep>): RemindableStep {
  return {
    id: "id",
    description: "Do the thing",
    taskName: "Thing",
    startMinute: 600,
    plannedMinutes: 30,
    isDone: false,
    remindedAt: null,
    ...overrides,
  };
}

describe("selectStepsToRemind", () => {
  const steps = [
    step({ id: "soon", startMinute: 608 }),
    step({ id: "now", startMinute: 600 }),
    step({ id: "late", startMinute: 596 }),
    step({ id: "too-late", startMinute: 590 }),
    step({ id: "later", startMinute: 640 }),
    step({ id: "done", startMinute: 605, isDone: true }),
    step({ id: "reminded", startMinute: 605, remindedAt: new Date() }),
  ];

  it("picks open, not-yet-reminded steps within the lead time", () => {
    expect(selectStepsToRemind(steps, 600, 10).map((s) => s.id)).toEqual([
      "late",
      "now",
      "soon",
    ]);
  });

  it("respects a zero lead time", () => {
    expect(selectStepsToRemind(steps, 600, 0, 0).map((s) => s.id)).toEqual([
      "now",
    ]);
  });
});

describe("escapeHtml", () => {
  it("escapes markup", () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe(
      "&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;",
    );
  });
});

describe("buildReminderEmail", () => {
  const url = "https://daybloom.example/planner";

  it("names the step in the subject when there is one", () => {
    const email = buildReminderEmail(
      [step({ startMinute: 570, description: "Write intro" })],
      url,
    );
    expect(email.subject).toBe("Up next at 09:30: Write intro");
    expect(email.text).toContain("09:30 · Write intro (30m, Thing)");
    expect(email.text).toContain(url);
  });

  it("summarizes several steps", () => {
    const email = buildReminderEmail(
      [step({ id: "a" }), step({ id: "b", startMinute: 610 })],
      url,
    );
    expect(email.subject).toBe("Up next: 2 steps starting soon");
  });

  it("escapes user content in the HTML version", () => {
    const email = buildReminderEmail(
      [step({ description: "<script>alert(1)</script>" })],
      url,
    );
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });
});
