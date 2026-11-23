/**
 * Minimal iCalendar (RFC 5545) writer for exporting plans to calendar apps
 * such as Google Calendar, Apple Calendar and Outlook.
 */

import { localDateTimeToInstant, type DateKey } from "../planner/lib/dates";

export interface IcsEvent {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  /** Marks finished steps as completed-looking in clients that support it. */
  isDone?: boolean;
  lastModified?: Date;
}

export interface IcsCalendar {
  name: string;
  productId?: string;
  events: IcsEvent[];
  /** Hint for clients on how often to refresh a subscribed feed. */
  refreshIntervalMinutes?: number;
}

const CRLF = "\r\n";

/** Escapes text values: backslash, semicolon, comma and newlines. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Folds a content line to at most 75 octets per line, as required by the
 * spec. Continuation lines start with a single space. Multi-byte characters
 * are never split.
 */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of line) {
    const charBytes = encoder.encode(char).length;
    // The first line can hold 75 octets, continuation lines 74 plus the space.
    const limit = chunks.length === 0 ? 75 : 74;
    if (currentBytes + charBytes > limit) {
      chunks.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += charBytes;
  }
  chunks.push(current);
  return chunks.join(`${CRLF} `);
}

/** 2026-11-23T09:30:00.000Z -> "20261123T093000Z" */
export function formatIcsUtc(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

export function buildIcsCalendar(calendar: IcsCalendar): string {
  const now = formatIcsUtc(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${calendar.productId ?? "-//Daybloom//Daybloom Planner//EN"}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendar.name)}`,
  ];
  if (calendar.refreshIntervalMinutes) {
    lines.push(
      `REFRESH-INTERVAL;VALUE=DURATION:PT${calendar.refreshIntervalMinutes}M`,
      `X-PUBLISHED-TTL:PT${calendar.refreshIntervalMinutes}M`,
    );
  }

  for (const event of calendar.events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${formatIcsUtc(event.start)}`,
      `DTEND:${formatIcsUtc(event.end)}`,
      `SUMMARY:${escapeIcsText(
        event.isDone ? `✓ ${event.summary}` : event.summary,
      )}`,
    );
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    }
    if (event.lastModified) {
      lines.push(`LAST-MODIFIED:${formatIcsUtc(event.lastModified)}`);
    }
    lines.push("TRANSP:OPAQUE", "END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join(CRLF) + CRLF;
}

export interface ExportablePlan {
  id: string;
  date: DateKey;
  updatedAt?: Date;
  steps: {
    id: string;
    taskName: string;
    taskPriority: string;
    description: string;
    startMinute: number;
    plannedMinutes: number;
    isDone: boolean;
  }[];
}

/** Turns plans into calendar events at the right local times. */
export function plansToIcsEvents(
  plans: ExportablePlan[],
  timeZone: string,
  uidDomain = "daybloom.app",
): IcsEvent[] {
  return plans.flatMap((plan) =>
    plan.steps.map((step) => {
      const start = localDateTimeToInstant(
        plan.date,
        step.startMinute,
        timeZone,
      );
      return {
        uid: `${step.id}@${uidDomain}`,
        start,
        end: new Date(start.getTime() + step.plannedMinutes * 60000),
        summary: step.description,
        description: `${step.taskName} (${step.taskPriority} priority)`,
        isDone: step.isDone,
        lastModified: plan.updatedAt,
      };
    }),
  );
}

/** A safe file name for a downloaded calendar, e.g. "daybloom-2026-11-23.ics". */
export function getIcsFileName(date: DateKey): string {
  return `daybloom-${date}.ics`;
}
