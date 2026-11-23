import { cn } from "../../client/utils";
import { isTaskPriority } from "../lib/scheduling";

const PRIORITY_STYLES = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-success/10 text-success border-success/20",
} as const;

const PRIORITY_LABELS = {
  high: "High",
  medium: "Medium",
  low: "Low",
} as const;

export function getPriorityLabel(priority: string): string {
  return isTaskPriority(priority) ? PRIORITY_LABELS[priority] : priority;
}

/** Small colored pill for a step's task priority. */
export function PriorityBadge({
  priority,
  className,
}: {
  priority: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
        isTaskPriority(priority)
          ? PRIORITY_STYLES[priority]
          : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {getPriorityLabel(priority)}
      <span className="sr-only"> priority</span>
    </span>
  );
}
