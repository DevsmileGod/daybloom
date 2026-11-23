import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  getPlannerSettings,
  getPlansInRange,
  useQuery,
} from "wasp/client/operations";
import type { PlanStep } from "wasp/entities";
import { PageContainer, PageHeader } from "../client/components/PageHeader";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../client/components/ui/alert";
import { Button } from "../client/components/ui/button";
import { Input } from "../client/components/ui/input";
import { getErrorMessage } from "../client/errors";
import { useLocalStorage } from "../client/hooks/useLocalStorage";
import { cn } from "../client/utils";
import { CalendarGrid } from "./calendar/CalendarGrid";
import {
  applyStartOverrides,
  DEFAULT_WINDOW_END_HOUR,
  DEFAULT_WINDOW_START_HOUR,
  getLatestPlanPerDay,
  getVisibleWindow,
  isCalendarView,
  type CalendarView,
} from "./calendar/calendarLayout";
import { StepDialog } from "./calendar/StepDialog";
import { useDragReschedule } from "./calendar/useDragReschedule";
import {
  addDaysToDateKey,
  formatDateKey,
  getLocalDateKey,
  getLocalMinuteOfDay,
  getRuntimeTimeZone,
  getWeekDateKeys,
  isValidDateKey,
  type DateKey,
} from "./lib/dates";
import { formatMinutesAsClock } from "./lib/time";

const FULL_DAY_WINDOW = { startHour: 0, endHour: 24 };
const DEFAULT_WINDOW = {
  startHour: DEFAULT_WINDOW_START_HOUR,
  endHour: DEFAULT_WINDOW_END_HOUR,
};

const PRIORITY_LEGEND = [
  { label: "High", className: "border-destructive bg-destructive/10" },
  { label: "Medium", className: "border-warning bg-warning/10" },
  { label: "Low", className: "border-success bg-success/10" },
];

interface SelectedStep {
  stepId: string;
  date: DateKey;
}

export function PlanCalendarPage() {
  const [storedView, setStoredView] = useLocalStorage<CalendarView>(
    "daybloom.calendar.view",
    getInitialView(),
  );
  const view: CalendarView = isCalendarView(storedView) ? storedView : "week";
  const [storedFullDay, setStoredFullDay] = useLocalStorage<boolean>(
    "daybloom.calendar.fullDay",
    false,
  );
  const showFullDay = storedFullDay === true;
  /** The day the view is centred on; null follows "today". */
  const [anchor, setAnchor] = useState<DateKey | null>(null);
  const [selected, setSelected] = useState<SelectedStep | null>(null);

  const { data: settings } = useQuery(getPlannerSettings);
  const timeZone = settings?.timeZone ?? getRuntimeTimeZone();
  const now = useNow();
  const today = getLocalDateKey(now, timeZone);
  const nowMinute = getLocalMinuteOfDay(now, timeZone);

  const anchorDate = anchor ?? today;
  const days = useMemo(
    () => (view === "week" ? getWeekDateKeys(anchorDate) : [anchorDate]),
    [view, anchorDate],
  );
  const from = days[0];
  const to = days[days.length - 1];

  const {
    data: plans,
    isLoading,
    error,
    refetch,
  } = useQuery(getPlansInRange, { from, to });

  const drag = useDragReschedule({ serverData: plans });

  const dayPlans = useMemo(() => getLatestPlanPerDay(plans ?? []), [plans]);

  const stepsByDay = useMemo(() => {
    const result = new Map<DateKey, PlanStep[]>();
    for (const day of days) {
      const dayPlan = dayPlans.get(day);
      if (dayPlan) {
        result.set(
          day,
          applyStartOverrides(dayPlan.plan.steps, drag.overrides),
        );
      }
    }
    return result;
  }, [days, dayPlans, drag.overrides]);

  const visibleWindow = useMemo(
    () =>
      getVisibleWindow(
        [...stepsByDay.values()].flat(),
        showFullDay ? FULL_DAY_WINDOW : DEFAULT_WINDOW,
      ),
    [stepsByDay, showFullDay],
  );

  const selectedStep = selected
    ? (stepsByDay
        .get(selected.date)
        ?.find((step) => step.id === selected.stepId) ?? null)
    : null;

  const stepDays = view === "week" ? 7 : 1;
  const rangeLabel =
    view === "week"
      ? `${formatDateKey(from, { month: "short", day: "numeric" })} – ${formatDateKey(
          to,
          { month: "short", day: "numeric", year: "numeric" },
        )}`
      : formatDateKey(anchorDate, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        });
  const isShowingToday = days.includes(today);

  return (
    <PageContainer>
      <PageHeader
        title="Calendar"
        description="See your plans on a timeline. Drag a step to change its time, or click it to edit."
      />

      <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Calendar view"
            className="bg-muted inline-flex rounded-md p-0.5"
          >
            {(["day", "week"] as const).map((option) => (
              <Button
                key={option}
                type="button"
                size="sm"
                variant={view === option ? "default" : "ghost"}
                aria-pressed={view === option}
                onClick={() => setStoredView(option)}
                className="capitalize"
              >
                {option}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label={view === "week" ? "Previous week" : "Previous day"}
              onClick={() => setAnchor(addDaysToDateKey(anchorDate, -stepDays))}
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAnchor(null)}
              disabled={anchor === null || anchorDate === today}
            >
              Today
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label={view === "week" ? "Next week" : "Next day"}
              onClick={() => setAnchor(addDaysToDateKey(anchorDate, stepDays))}
            >
              <ChevronRight />
            </Button>
          </div>

          <h2
            className="text-foreground text-lg font-semibold"
            aria-live="polite"
          >
            {rangeLabel}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            aria-label="Jump to date"
            value={anchorDate}
            onChange={(event) => {
              const value = event.target.value;
              if (isValidDateKey(value)) {
                setAnchor(value === today ? null : value);
              }
            }}
            className="h-9 w-auto"
          />
          <Button
            type="button"
            variant="outline"
            aria-pressed={showFullDay}
            onClick={() => setStoredFullDay(!showFullDay)}
          >
            {showFullDay ? <Minimize2 /> : <Maximize2 />}
            {showFullDay
              ? `Show ${formatMinutesAsClock(DEFAULT_WINDOW_START_HOUR * 60)}–${formatMinutesAsClock(DEFAULT_WINDOW_END_HOUR * 60)}`
              : "Show full day"}
          </Button>
        </div>
      </div>

      <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span>Priority:</span>
        {PRIORITY_LEGEND.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn("h-3 w-3 rounded-sm border-l-4", item.className)}
            />
            {item.label}
          </span>
        ))}
        {!isShowingToday && (
          <span className="ml-auto">
            Today is{" "}
            {formatDateKey(today, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>

      <div className="mt-4">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Couldn't load your plans</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span>{getErrorMessage(error)}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void refetch()}
              >
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : isLoading || !plans ? (
          <div
            className="bg-card text-muted-foreground flex h-96 items-center justify-center gap-2 rounded-xl border text-sm"
            role="status"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading your plans…
          </div>
        ) : (
          <CalendarGrid
            days={days}
            dayPlans={dayPlans}
            stepsByDay={stepsByDay}
            visibleWindow={visibleWindow}
            today={today}
            nowMinute={nowMinute}
            drag={drag}
            onOpenStep={(stepId, date) => setSelected({ stepId, date })}
          />
        )}
      </div>

      <p className="text-muted-foreground mt-3 text-xs">
        Times are shown in {timeZone}. On touch devices, tap a step to change
        its time. With the keyboard, focus a step and press Alt+↑ or Alt+↓ to
        move it by 15 minutes.
      </p>

      <StepDialog
        step={selectedStep}
        date={selected?.date ?? null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </PageContainer>
  );
}

function getInitialView(): CalendarView {
  if (typeof window === "undefined") return "week";
  return window.matchMedia("(max-width: 639px)").matches ? "day" : "week";
}

/** The current time, refreshed every minute for the "now" line. */
function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
