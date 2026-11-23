import { CheckCircle2, Clock, Timer } from "lucide-react";
import type { ReactNode } from "react";
import type { PlanStep } from "wasp/entities";
import { Progress } from "../../client/components/ui/progress";
import { cn } from "../../client/utils";
import { useNow } from "../hooks/useNow";
import { summarizeSteps } from "../lib/stats";
import { formatDuration } from "../lib/time";
import { getTrackedMinutes } from "./timer";

/**
 * Done/total steps, planned vs tracked time and a progress bar for a plan.
 * Tracked time includes running timers and refreshes while one runs.
 */
export function PlanSummaryBar({
  steps,
  className,
}: {
  steps: PlanStep[];
  className?: string;
}) {
  const hasRunningTimer = steps.some((step) => step.timerStartedAt !== null);
  const now = useNow(15_000, hasRunningTimer);
  const summary = summarizeSteps(steps);
  const trackedMinutes = getTrackedMinutes(steps, now);
  const percent = Math.round(summary.completionRate * 100);

  return (
    <div
      className={cn("bg-muted/40 space-y-3 rounded-lg border p-4", className)}
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <SummaryItem
          icon={<CheckCircle2 className="text-success" />}
          label="Steps done"
          value={`${summary.doneSteps}/${summary.totalSteps}`}
        />
        <SummaryItem
          icon={<Clock className="text-primary" />}
          label="Planned"
          value={formatDuration(summary.plannedMinutes)}
        />
        <SummaryItem
          icon={
            <Timer
              className={cn(
                "text-muted-foreground",
                hasRunningTimer && "text-primary animate-pulse",
              )}
            />
          }
          label="Tracked"
          value={formatDuration(trackedMinutes)}
        />
        <span className="text-foreground ml-auto text-sm font-semibold tabular-nums">
          {percent}%
        </span>
      </div>
      <Progress value={percent} aria-label={`${percent}% of steps done`} />
    </div>
  );
}

function SummaryItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <span className="flex items-center gap-1.5 [&_svg]:size-4">
      {icon}
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium tabular-nums">{value}</span>
    </span>
  );
}
