import type { CalendarFeed } from "wasp/server/api";
import { addDaysToDateKey } from "../planner/lib/dates";
import { getUserToday } from "../recurring/materialize";
import { buildIcsCalendar, plansToIcsEvents } from "./ics";

const FEED_DAYS_BACK = 30;
const FEED_DAYS_AHEAD = 60;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,100}$/;

/**
 * Private iCalendar feed: GET /calendar-feed/:token
 *
 * Calendar apps can't send our auth headers, so the feed is protected by an
 * unguessable per-user token instead. Users can rotate or disable it in
 * their settings.
 */
export const calendarFeed: CalendarFeed = async (request, response, context) => {
  const rawToken = String(request.params.token ?? "").replace(/\.ics$/, "");
  if (!TOKEN_PATTERN.test(rawToken)) {
    return response.status(404).send("Not found");
  }

  const user = await context.entities.User.findUnique({
    where: { calendarFeedToken: rawToken },
    select: { id: true, timeZone: true },
  });
  if (!user) {
    return response.status(404).send("Not found");
  }

  const today = getUserToday(user.timeZone);
  const plans = await context.entities.Plan.findMany({
    where: {
      userId: user.id,
      date: {
        gte: addDaysToDateKey(today, -FEED_DAYS_BACK),
        lte: addDaysToDateKey(today, FEED_DAYS_AHEAD),
      },
    },
    include: { steps: { orderBy: { position: "asc" } } },
  });

  const ics = buildIcsCalendar({
    name: "Daybloom",
    refreshIntervalMinutes: 60,
    events: plansToIcsEvents(plans, user.timeZone),
  });

  return response
    .status(200)
    .set({
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="daybloom.ics"',
      "Cache-Control": "private, max-age=300",
    })
    .send(ics);
};
