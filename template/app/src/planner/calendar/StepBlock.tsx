import { CheckCircle2 } from "lucide-react";
import type { DragEvent, KeyboardEvent } from "react";
import type { PlanStep } from "wasp/entities";
import { cn } from "../../client/utils";
import { formatMinutesAsClock } from "../lib/time";
import {
  getPriorityClasses,
  getStepEndMinute,
  MIN_BLOCK_HEIGHT_PX,
  minutesToPx,
  SNAP_MINUTES,
} from "./calendarLayout";

export interface StepBlockDragProps {
  draggable: boolean;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}

interface StepBlockProps {
  step: PlanStep;
  column: number;
  columnCount: number;
  windowStartMinute: number;
  isDragging: boolean;
  dragProps: StepBlockDragProps;
  onOpen: () => void;
  onNudge: (deltaMinutes: number) => void;
}

export function StepBlock({
  step,
  column,
  columnCount,
  windowStartMinute,
  isDragging,
  dragProps,
  onOpen,
  onNudge,
}: StepBlockProps) {
  const endMinute = getStepEndMinute(step);
  const top = minutesToPx(step.startMinute - windowStartMinute);
  const height = Math.max(
    MIN_BLOCK_HEIGHT_PX,
    minutesToPx(endMinute - step.startMinute),
  );
  const widthPercent = 100 / columnCount;
  const isCompact = height < 40;
  const timeRange = `${formatMinutesAsClock(step.startMinute)}–${formatMinutesAsClock(endMinute)}`;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    } else if (event.altKey && event.key === "ArrowUp") {
      event.preventDefault();
      onNudge(-SNAP_MINUTES);
    } else if (event.altKey && event.key === "ArrowDown") {
      event.preventDefault();
      onNudge(SNAP_MINUTES);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${step.description}, ${timeRange}, ${step.taskName}, ${step.taskPriority} priority${step.isDone ? ", done" : ""}. Press Enter to edit, Alt+Up or Alt+Down to move by ${SNAP_MINUTES} minutes.`}
      aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
      title={`${timeRange} · ${step.description}`}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      {...dragProps}
      className={cn(
        "text-foreground focus-visible:ring-ring absolute cursor-grab select-none overflow-hidden rounded-md border-l-4 px-1.5 text-left text-xs shadow-sm transition-colors focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 active:cursor-grabbing",
        getPriorityClasses(step.taskPriority),
        isCompact ? "py-0.5" : "py-1",
        step.isDone && "opacity-60",
        isDragging && "opacity-40",
      )}
      style={{
        top,
        height,
        left: `calc(${column * widthPercent}% + 2px)`,
        width: `calc(${widthPercent}% - 4px)`,
      }}
    >
      {isCompact ? (
        <p className="truncate leading-4">
          <span className="text-muted-foreground mr-1 tabular-nums">
            {formatMinutesAsClock(step.startMinute)}
          </span>
          <span className={cn("font-medium", step.isDone && "line-through")}>
            {step.description}
          </span>
        </p>
      ) : (
        <>
          <p className="text-muted-foreground flex items-center gap-1 truncate tabular-nums leading-4">
            {step.isDone && (
              <CheckCircle2 className="text-success size-3 shrink-0" />
            )}
            {timeRange}
          </p>
          <p
            className={cn(
              "line-clamp-2 break-words font-medium leading-4",
              step.isDone && "line-through",
            )}
          >
            {step.description}
          </p>
          {height >= 72 && (
            <p className="text-muted-foreground mt-0.5 truncate leading-4">
              {step.taskName}
            </p>
          )}
        </>
      )}
    </div>
  );
}
