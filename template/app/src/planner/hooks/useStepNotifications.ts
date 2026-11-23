import { useCallback, useEffect, useState } from "react";
import { getTodayDateKey, localDateTimeToInstant } from "../lib/dates";
import { formatDuration } from "../lib/time";

type NotificationPermissionState = NotificationPermission | "unsupported";

interface NotifiablePlan {
  date: string;
  steps: {
    id: string;
    description: string;
    taskName: string;
    startMinute: number;
    plannedMinutes: number;
    isDone: boolean;
  }[];
}

// Browsers clamp longer timeouts to ~24.8 days and fire them immediately.
const MAX_TIMEOUT_MS = 2_147_483_647;

function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

function readPermission(): NotificationPermissionState {
  return isNotificationSupported() ? Notification.permission : "unsupported";
}

/**
 * Shows a browser notification when each unfinished step of today's plan
 * starts. Only schedules while the page is open and permission is granted.
 */
export function useStepNotifications(
  plan: NotifiablePlan | null | undefined,
  timeZone: string,
) {
  const [permission, setPermission] =
    useState<NotificationPermissionState>(readPermission);

  const requestPermission = useCallback(async () => {
    if (!isNotificationSupported()) return;
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      setPermission(readPermission());
    }
  }, []);

  useEffect(() => {
    if (!plan || permission !== "granted" || !isNotificationSupported()) {
      return;
    }
    if (plan.date !== getTodayDateKey(timeZone)) return;

    const now = Date.now();
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const step of plan.steps) {
      if (step.isDone) continue;
      const startsAt = localDateTimeToInstant(
        plan.date,
        step.startMinute,
        timeZone,
      ).getTime();
      const delay = startsAt - now;
      if (delay <= 0 || delay > MAX_TIMEOUT_MS) continue;

      timers.push(
        setTimeout(() => {
          try {
            new Notification(`Time for: ${step.description}`, {
              body: `${step.taskName} · ${formatDuration(step.plannedMinutes)}`,
              tag: `daybloom-step-${step.id}`,
            });
          } catch {
            // Some browsers (e.g. Android Chrome) only allow notifications
            // from a service worker; reminders are best-effort.
          }
        }, delay),
      );
    }

    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [plan, permission, timeZone]);

  return { permission, requestPermission };
}
