import {
  buildIcsCalendar,
  getIcsFileName,
  plansToIcsEvents,
  type ExportablePlan,
} from "../../calendar-export/ics";
import { formatDateKey } from "../lib/dates";

/** Builds an .ics file for one plan in the browser and downloads it. */
export function downloadPlanIcs(plan: ExportablePlan, timeZone: string) {
  const content = buildIcsCalendar({
    name: `Daybloom · ${formatDateKey(plan.date)}`,
    events: plansToIcsEvents([plan], timeZone),
  });
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = getIcsFileName(plan.date);
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
