import {
  BarChart3,
  CheckCircle2,
  Flame,
  Gauge,
  Target,
  Timer,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { getPlannerStats, useQuery } from "wasp/client/operations";
import { Link, routes } from "wasp/client/router";
import { PageContainer, PageHeader } from "../client/components/PageHeader";
import { Button } from "../client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../client/components/ui/card";
import { Progress } from "../client/components/ui/progress";
import { cn } from "../client/utils";
import { EmptyState, ErrorState, LoadingState } from "./components/PageStates";
import { PriorityBadge } from "./components/PriorityBadge";
import { usePlannerTimeZone } from "./hooks/usePlannerTimeZone";
import {
  addDaysToDateKey,
  formatDateKey,
  getWeekDateKeys,
  type DateKey,
} from "./lib/dates";
import type { DayStats, PriorityStats, TaskTimeStats } from "./lib/stats";
import { formatDuration } from "./lib/time";
import type { PlannerStats } from "./types";

type Period = "week" | "month" | "quarter";

const PERIODS: { id: Period; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "month", label: "Last 4 weeks" },
  { id: "quarter", label: "Last 3 months" },
];

/** Date range of a period. Stays within the server's 92-day limit. */
function getPeriodRange(
  period: Period,
  today: DateKey,
): { from: DateKey; to: DateKey } {
  switch (period) {
    case "week": {
      const week = getWeekDateKeys(today);
      return { from: week[0], to: week[week.length - 1] };
    }
    case "month":
      return { from: addDaysToDateKey(today, -27), to: today };
    case "quarter":
      return { from: addDaysToDateKey(today, -90), to: today };
  }
}

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function StatsPage() {
  const { today, isLoading: isSettingsLoading } = usePlannerTimeZone();
  const [period, setPeriod] = useState<Period>("week");
  const range = getPeriodRange(period, today);

  const statsQuery = useQuery(getPlannerStats, range, {
    enabled: !isSettingsLoading,
  });
  const stats = statsQuery.data;

  let content: ReactNode;
  if (isSettingsLoading || statsQuery.isLoading) {
    content = <LoadingState label="Crunching your numbers…" />;
  } else if (statsQuery.error || !stats) {
    content = (
      <ErrorState
        error={statsQuery.error}
        title="Couldn't load your stats"
        action={
          <Button variant="outline" onClick={() => statsQuery.refetch()}>
            Try again
          </Button>
        }
      />
    );
  } else if (stats.totals.totalSteps === 0) {
    content = (
      <div className="space-y-6">
        {stats.streak > 0 && <StatCards stats={stats} />}
        <EmptyState
          icon={<BarChart3 />}
          title="No planned steps in this period"
          description="Plan a few days and check off steps to see your progress here."
          action={
            <Button asChild>
              <Link to={routes.PlannerRoute.to}>Go to the planner</Link>
            </Button>
          }
        />
      </div>
    );
  } else {
    content = <StatsContent stats={stats} />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Progress"
        description={`${formatDateKey(range.from)} – ${formatDateKey(range.to)}`}
        actions={
          <div
            role="group"
            aria-label="Period"
            className="bg-muted inline-flex rounded-lg p-1"
          >
            {PERIODS.map((option) => (
              <Button
                key={option.id}
                size="sm"
                variant={period === option.id ? "default" : "ghost"}
                aria-pressed={period === option.id}
                onClick={() => setPeriod(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        }
      />
      <div className="mt-8">{content}</div>
    </PageContainer>
  );
}

function StatsContent({ stats }: { stats: PlannerStats }) {
  return (
    <div className="space-y-6">
      <StatCards stats={stats} />
      <DailyChart days={stats.days} today={stats.today} />
      <div className="grid gap-6 lg:grid-cols-2">
        <PriorityBreakdown byPriority={stats.byPriority} />
        <TopTasks tasks={stats.topTasks} />
      </div>
    </div>
  );
}

//#region Stat cards

function describeEstimate(ratio: number | null): {
  value: string;
  detail: string;
} {
  if (ratio === null) {
    return { value: "–", detail: "No tracked time yet" };
  }
  const difference = Math.round(Math.abs(ratio - 1) * 100);
  if (difference < 5) {
    return {
      value: "On target",
      detail: "Steps take about as long as planned",
    };
  }
  return ratio > 1
    ? {
        value: `+${difference}%`,
        detail: `Steps take ${difference}% longer than planned`,
      }
    : {
        value: `−${difference}%`,
        detail: `Steps take ${difference}% less time than planned`,
      };
}

function StatCards({ stats }: { stats: PlannerStats }) {
  const { totals } = stats;
  const estimate = describeEstimate(stats.estimateRatio);

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <StatCard
        icon={<Target />}
        label="Completion rate"
        value={formatPercent(totals.completionRate)}
        detail={`${stats.activeDays} active ${
          stats.activeDays === 1 ? "day" : "days"
        }`}
      />
      <StatCard
        icon={<CheckCircle2 />}
        label="Steps done"
        value={`${totals.doneSteps}`}
        detail={`of ${totals.totalSteps} planned`}
      />
      <StatCard
        icon={<Timer />}
        label="Tracked time"
        value={formatDuration(totals.trackedMinutes)}
        detail={`${formatDuration(totals.plannedMinutes)} planned`}
      />
      <StatCard
        icon={<Flame />}
        label="Current streak"
        value={`${stats.streak} ${stats.streak === 1 ? "day" : "days"}`}
        detail={
          stats.streak > 0
            ? "Days in a row with a finished step"
            : "Finish a step to start one"
        }
      />
      <StatCard
        icon={<Gauge />}
        label="Estimate accuracy"
        value={estimate.value}
        detail={estimate.detail}
        className="col-span-2 lg:col-span-1"
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  className?: string;
}) {
  return (
    <Card className={cn("p-4 hover:shadow", className)}>
      <div className="text-muted-foreground flex items-center gap-2 text-sm [&_svg]:size-4">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <p className="text-foreground mt-2 text-2xl font-bold tabular-nums">
        {value}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">{detail}</p>
    </Card>
  );
}

//#endregion

//#region Daily chart

function getLabelEvery(dayCount: number): number {
  if (dayCount <= 7) return 1;
  if (dayCount <= 31) return 7;
  return 14;
}

function formatChartLabel(date: DateKey, dayCount: number): string {
  return dayCount <= 7
    ? formatDateKey(date, { weekday: "short" })
    : formatDateKey(date, { month: "short", day: "numeric" });
}

/** Planned vs completed minutes per day as overlaid CSS bars. */
function DailyChart({ days, today }: { days: DayStats[]; today: DateKey }) {
  const maxMinutes = Math.max(
    60,
    ...days.map((day) =>
      Math.max(day.plannedMinutes, day.completedPlannedMinutes),
    ),
  );
  const labelEvery = getLabelEvery(days.length);
  const isDense = days.length > 31;

  return (
    <Card className="hover:shadow">
      <CardHeader className="gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>Planned vs completed</CardTitle>
          <CardDescription>
            Minutes planned each day and how much of it you finished.
          </CardDescription>
        </div>
        <div className="text-muted-foreground flex items-center gap-4 text-xs">
          <LegendSwatch className="bg-primary/25" label="Planned" />
          <LegendSwatch className="bg-primary" label="Completed" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <div className="text-muted-foreground flex h-44 flex-col justify-between pb-0 text-right text-[11px] tabular-nums">
            <span>{formatDuration(maxMinutes)}</span>
            <span>{formatDuration(maxMinutes / 2)}</span>
            <span>0</span>
          </div>
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                "relative flex h-44 items-end border-b",
                isDense ? "gap-px" : "gap-1 sm:gap-2",
              )}
              aria-hidden="true"
            >
              <div className="border-muted pointer-events-none absolute inset-x-0 top-0 border-t border-dashed" />
              <div className="border-muted pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed" />
              {days.map((day) => (
                <ChartBar
                  key={day.date}
                  day={day}
                  maxMinutes={maxMinutes}
                  isToday={day.date === today}
                />
              ))}
            </div>
            <div
              className={cn(
                "mt-1 flex overflow-hidden",
                isDense ? "gap-px" : "gap-1 sm:gap-2",
              )}
              aria-hidden="true"
            >
              {days.map((day, index) => (
                <div
                  key={day.date}
                  className="text-muted-foreground relative h-4 min-w-0 flex-1 text-center text-[10px] sm:text-[11px]"
                >
                  {index % labelEvery === 0 && (
                    <span
                      className={cn(
                        "whitespace-nowrap",
                        isDense || labelEvery > 1
                          ? "absolute left-0"
                          : "block truncate",
                        day.date === today && "text-foreground font-semibold",
                      )}
                    >
                      {formatChartLabel(day.date, days.length)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <ChartDataTable days={days} />
      </CardContent>
    </Card>
  );
}

function ChartBar({
  day,
  maxMinutes,
  isToday,
}: {
  day: DayStats;
  maxMinutes: number;
  isToday: boolean;
}) {
  const plannedHeight = (day.plannedMinutes / maxMinutes) * 100;
  const completedHeight = (day.completedPlannedMinutes / maxMinutes) * 100;

  return (
    <div className="group relative flex h-full min-w-0 flex-1 items-end justify-center">
      <div
        className={cn(
          "relative h-full w-full max-w-10",
          isToday && "bg-muted/60 rounded-t",
        )}
      >
        {day.plannedMinutes > 0 && (
          <div
            className="bg-primary/25 group-hover:bg-primary/35 absolute inset-x-0 bottom-0 rounded-t transition-colors"
            style={{ height: `${plannedHeight}%` }}
          />
        )}
        {day.completedPlannedMinutes > 0 && (
          <div
            className="bg-primary absolute inset-x-0 bottom-0 rounded-t"
            style={{ height: `${completedHeight}%` }}
          />
        )}
      </div>
      <div className="bg-popover text-popover-foreground pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-xs shadow-md group-hover:block">
        <p className="font-medium">{formatDateKey(day.date)}</p>
        <p className="text-muted-foreground">
          {formatDuration(day.completedPlannedMinutes)} /{" "}
          {formatDuration(day.plannedMinutes)} · {day.doneSteps}/
          {day.totalSteps} steps
        </p>
      </div>
    </div>
  );
}

function LegendSwatch({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-3 rounded-sm", className)} aria-hidden="true" />
      {label}
    </span>
  );
}

/** Screen-reader version of the chart. */
function ChartDataTable({ days }: { days: DayStats[] }) {
  return (
    <table className="sr-only">
      <caption>Planned and completed minutes per day</caption>
      <thead>
        <tr>
          <th scope="col">Day</th>
          <th scope="col">Planned</th>
          <th scope="col">Completed</th>
          <th scope="col">Steps done</th>
        </tr>
      </thead>
      <tbody>
        {days.map((day) => (
          <tr key={day.date}>
            <th scope="row">{formatDateKey(day.date)}</th>
            <td>{formatDuration(day.plannedMinutes)}</td>
            <td>{formatDuration(day.completedPlannedMinutes)}</td>
            <td>
              {day.doneSteps} of {day.totalSteps}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

//#endregion

//#region Breakdowns

function PriorityBreakdown({ byPriority }: { byPriority: PriorityStats[] }) {
  return (
    <Card className="hover:shadow">
      <CardHeader>
        <CardTitle>Completion by priority</CardTitle>
        <CardDescription>
          Share of steps finished for each task priority.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {byPriority.length === 0 ? (
          <p className="text-muted-foreground text-sm">No steps yet.</p>
        ) : (
          <ul className="space-y-4">
            {byPriority.map((item) => {
              const percent = Math.round(item.completionRate * 100);
              return (
                <li key={item.priority} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <PriorityBadge priority={item.priority} />
                    <span className="text-muted-foreground tabular-nums">
                      {item.doneSteps}/{item.totalSteps} ·{" "}
                      <span className="text-foreground font-medium">
                        {percent}%
                      </span>
                    </span>
                  </div>
                  <Progress
                    value={percent}
                    aria-label={`${item.priority} priority: ${percent}% done`}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TopTasks({ tasks }: { tasks: TaskTimeStats[] }) {
  const maxMinutes = Math.max(
    1,
    ...tasks.map((task) => Math.max(task.plannedMinutes, task.trackedMinutes)),
  );

  return (
    <Card className="hover:shadow">
      <CardHeader className="gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>Top tasks by time</CardTitle>
          <CardDescription>Where your days went.</CardDescription>
        </div>
        <div className="text-muted-foreground flex items-center gap-4 text-xs">
          <LegendSwatch className="bg-primary/25" label="Planned" />
          <LegendSwatch className="bg-primary" label="Tracked" />
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-muted-foreground text-sm">No tasks yet.</p>
        ) : (
          <ol className="space-y-4">
            {tasks.map((task) => (
              <li key={task.taskName} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-foreground min-w-0 truncate font-medium">
                    {task.taskName}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {formatDuration(task.plannedMinutes)} planned ·{" "}
                    {formatDuration(task.trackedMinutes)} tracked
                  </span>
                </div>
                <div className="space-y-1" aria-hidden="true">
                  <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                    <div
                      className="bg-primary/25 h-full rounded-full"
                      style={{
                        width: `${(task.plannedMinutes / maxMinutes) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{
                        width: `${(task.trackedMinutes / maxMinutes) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <p className="text-muted-foreground text-xs">
                  {task.doneSteps}/{task.totalSteps} steps done
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

//#endregion
