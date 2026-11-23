import { action, api, query, type Spec } from "@wasp/spec";

import { calendarFeed } from "./feed" with { type: "ref" };
import {
  disableCalendarFeed,
  getCalendarFeed,
  rotateCalendarFeedToken,
} from "./operations" with { type: "ref" };

export const calendarExportSpec: Spec = [
  query(getCalendarFeed, { entities: ["User"] }),
  action(rotateCalendarFeedToken, { entities: ["User"] }),
  action(disableCalendarFeed, { entities: ["User"] }),
  api("GET", "/calendar-feed/:token", calendarFeed, {
    entities: ["User", "Plan", "PlanStep"],
  }),
];
