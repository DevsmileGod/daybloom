import { randomBytes } from "crypto";
import { config, HttpError } from "wasp/server";
import type {
  DisableCalendarFeed,
  GetCalendarFeed,
  RotateCalendarFeedToken,
} from "wasp/server/operations";

export type CalendarFeedInfo = {
  /** Subscribable URL, or null when the feed is turned off. */
  url: string | null;
};

export function buildCalendarFeedUrl(token: string): string {
  return `${config.serverUrl}/calendar-feed/${token}`;
}

function generateFeedToken(): string {
  return randomBytes(24).toString("base64url");
}

export const getCalendarFeed: GetCalendarFeed<void, CalendarFeedInfo> = async (
  _args,
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  const user = await context.entities.User.findUnique({
    where: { id: context.user.id },
    select: { calendarFeedToken: true },
  });
  return {
    url: user?.calendarFeedToken
      ? buildCalendarFeedUrl(user.calendarFeedToken)
      : null,
  };
};

/**
 * Turns the feed on, or replaces its URL with a new one. Calendars still
 * subscribed to the old URL stop receiving updates.
 */
export const rotateCalendarFeedToken: RotateCalendarFeedToken<
  void,
  CalendarFeedInfo
> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  const token = generateFeedToken();
  await context.entities.User.update({
    where: { id: context.user.id },
    data: { calendarFeedToken: token },
  });
  return { url: buildCalendarFeedUrl(token) };
};

export const disableCalendarFeed: DisableCalendarFeed<
  void,
  CalendarFeedInfo
> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  await context.entities.User.update({
    where: { id: context.user.id },
    data: { calendarFeedToken: null },
  });
  return { url: null };
};
