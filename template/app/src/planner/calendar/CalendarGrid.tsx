import { CalendarPlus } from "lucide-react";
import type { CSSProperties } from "react";
import { Link, routes } from "wasp/client/router";
import type { PlanStep } from "wasp/entities";
import { cn } from "../../client/utils";
import {
  formatDateKey,
  getDayOfWeek,
  SHORT_DAY_NAMES,
  type DateKey,
} from "../lib/dates";
import { layoutOverlappingSteps } from "../lib/scheduling";
import { formatMinutesAsClock } from "../lib/time";
import {
  HOUR_HEIGHT_PX,
  MIN_BLOCK_HEIGHT_PX,
  minutesToPx,
  type DayPlan,
  type VisibleWindow,
} from "./calendarLayout";
import { StepBlock } from "./StepBlock";
import type { DragReschedule } from "./useDragReschedule";

interface CalendarGridProps {
  days: DateKey[];
  dayPlans: Map<DateKey, DayPlan>;
  /** Steps to draw per day, with optimistic changes already applied. */
  stepsByDay: Map<DateKey, PlanStep[]>;
  visibleWindow: VisibleWindow;
  today: DateKey;
  nowMinute: number;
  drag: DragReschedule;
  onOpenStep: (stepId: string, date: DateKey) => void;
}

const GUTTER_WIDTH = "3.5rem";

export function CalendarGrid({
  days,
  dayPlans,
  stepsByDay,
  visibleWindow,
  today,
  nowMinute,
  drag,
  onOpenStep,
}: CalendarGridProps) {
  const { startHour, endHour } = visibleWindow;
  const windowStartMinute = startHour * 60;
  const hourCount = endHour - startHour;
  const gridHeight = hourCount * HOUR_HEIGHT_PX;
  const hours = Array.from({ length: hourCount }, (_, index) => startHour + index);
  const isWeek = days.length > 1;

  const gridStyle: CSSProperties = {
    gridTemplateColumns: `${GUTTER_WIDTH} repeat(${days.length}, minmax(0, 1fr))`,
  };

  return (
    <div className="bg-card overflow-x-auto rounded-xl border shadow-sm">
      <div className={cn(isWeek && "min-w-[720px]")}>
        {/* Day headers */}
        <div className="bg-card grid border-b" style={gridStyle}>
          <div aria-hidden="true" />
          {days.map((day) => (
            <DayHeader
              key={day}
              day={day}
              dayPlan={dayPlans.get(day)}
              isToday={day === today}
            />
          ))}
        </div>

        {/* Time grid */}
        <div className="grid" style={gridStyle}>
          <div
            className="relative"
            style={{ height: gridHeight }}
            aria-hidden="true"
          >
            {hours.map((hour, index) => (
              <span
                key={hour}
                className={cn(
                  "text-muted-foreground absolute right-2 text-[11px] tabular-nums",
                  index === 0 ? "translate-y-0.5" : "-translate-y-1/2",
                )}
                style={{ top: index * HOUR_HEIGHT_PX }}
              >
                {formatMinutesAsClock(hour * 60)}
              </span>
            ))}
          </div>

          {days.map((day) => {
            const steps = stepsByDay.get(day) ?? [];
            const dayPlan = dayPlans.get(day);
            const preview =
              drag.preview && drag.preview.date === day ? drag.preview : null;
            const showNowLine =
              day === today &&
              nowMinute >= windowStartMinute &&
              nowMinute <= endHour * 60;

            return (
              <div
                key={day}
                role="group"
                aria-label={`Schedule for ${formatDateKey(day, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}`}
                className={cn(
                  "relative border-l",
                  day === today && "bg-primary/[0.03]",
                  preview && !preview.isValid && "bg-destructive/5",
                )}
                style={{ height: gridHeight }}
                {...drag.getColumnDropProps(day, windowStartMinute)}
              >
                {hours.map((hour, index) => (
                  <div key={hour} aria-hidden="true">
                    {index > 0 && (
                      <div
                        className="border-border absolute inset-x-0 border-t"
                        style={{ top: index * HOUR_HEIGHT_PX }}
                      />
                    )}
                    <div
                      className="border-border/50 absolute inset-x-0 border-t border-dashed"
                      style={{ top: index * HOUR_HEIGHT_PX + HOUR_HEIGHT_PX / 2 }}
                    />
                  </div>
                ))}

                {!dayPlan && !isWeek && <EmptyDayOverlay />}
                {dayPlan && steps.length === 0 && (
                  <p className="text-muted-foreground absolute inset-x-0 top-4 px-2 text-center text-xs">
                    This plan has no steps yet.
                  </p>
                )}

                {layoutOverlappingSteps(steps).map(
                  ({ step, column, columnCount }) => (
                    <StepBlock
                      key={step.id}
                      step={step}
                      column={column}
                      columnCount={columnCount}
                      windowStartMinute={windowStartMinute}
                      isDragging={drag.draggingStepId === step.id}
                      dragProps={drag.getBlockDragProps(step, day)}
                      onOpen={() => onOpenStep(step.id, day)}
                      onNudge={(delta) => void drag.nudge(step, delta)}
                    />
                  ),
                )}

                {preview && (
                  <div
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute inset-x-0.5 z-10 rounded-md border-2 border-dashed px-1.5 py-0.5 text-[11px] font-medium",
                      preview.isValid
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-destructive bg-destructive/10 text-destructive",
                    )}
                    style={{
                      top: minutesToPx(preview.startMinute - windowStartMinute),
                      height: Math.max(
                        MIN_BLOCK_HEIGHT_PX,
                        minutesToPx(preview.plannedMinutes),
                      ),
                    }}
                  >
                    {preview.isValid
                      ? formatMinutesAsClock(preview.startMinute)
                      : "Same day only"}
                  </div>
                )}

                {showNowLine && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                    style={{ top: minutesToPx(nowMinute - windowStartMinute) }}
                    title={`Now, ${formatMinutesAsClock(nowMinute)}`}
                  >
                    <span className="bg-destructive -ml-1 size-2 shrink-0 -translate-y-px rounded-full" />
                    <span className="bg-destructive h-0.5 flex-1 -translate-y-px" />
                    <span className="sr-only">
                      Current time {formatMinutesAsClock(nowMinute)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DayHeader({
  day,
  dayPlan,
  isToday,
}: {
  day: DateKey;
  dayPlan: DayPlan | undefined;
  isToday: boolean;
}) {
  const steps = dayPlan?.plan.steps ?? [];
  const doneCount = steps.filter((step) => step.isDone).length;
  const olderCount = dayPlan?.olderPlanCount ?? 0;

  return (
    <div className="min-w-0 border-l px-2 py-2 text-center">
      <p className="text-muted-foreground text-xs font-medium uppercase">
        {SHORT_DAY_NAMES[getDayOfWeek(day)]}
      </p>
      <p
        className={cn(
          "mx-auto mt-0.5 inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-sm font-semibold",
          isToday ? "bg-primary text-primary-foreground" : "text-foreground",
        )}
        aria-current={isToday ? "date" : undefined}
      >
        {formatDateKey(day, { day: "numeric" })}
        {isToday && <span className="sr-only"> (today)</span>}
      </p>
      <div className="mt-1 flex min-h-8 flex-col items-center justify-start gap-0.5 text-[11px] leading-4">
        {dayPlan ? (
          <>
            <Link
              to={routes.PlanDetailRoute.to}
              params={{ planId: dayPlan.plan.id }}
              className="text-primary truncate hover:underline"
            >
              {steps.length === 0
                ? "Open plan"
                : `${doneCount}/${steps.length} done`}
            </Link>
            {olderCount > 0 && (
              <Link
                to={routes.PlanHistoryRoute.to}
                className="text-muted-foreground hover:text-foreground truncate hover:underline"
              >
                +{olderCount} older {olderCount === 1 ? "plan" : "plans"}
              </Link>
            )}
          </>
        ) : (
          <>
            <span className="text-muted-foreground">No plan</span>
            <Link
              to={routes.PlannerRoute.to}
              className="text-primary truncate hover:underline"
            >
              Plan a day
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyDayOverlay() {
  return (
    <div className="absolute inset-x-0 top-8 z-10 flex justify-center px-4">
      <div className="bg-card/90 text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-4 text-center text-sm backdrop-blur-sm">
        <CalendarPlus className="size-5" aria-hidden="true" />
        <p>No plan for this day.</p>
        <Link
          to={routes.PlannerRoute.to}
          className="text-primary font-medium hover:underline"
        >
          Go to the planner
        </Link>
      </div>
    </div>
  );
}
