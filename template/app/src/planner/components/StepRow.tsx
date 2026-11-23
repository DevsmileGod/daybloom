import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Pencil,
  Play,
  Square,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import {
  deletePlanStep,
  reorderPlanStep,
  startStepTimer,
  stopStepTimer,
  updatePlanStep,
} from "wasp/client/operations";
import type { PlanStep } from "wasp/entities";
import { Button } from "../../client/components/ui/button";
import { Checkbox } from "../../client/components/ui/checkbox";
import { cn } from "../../client/utils";
import { useNow } from "../hooks/useNow";
import { formatDuration, formatMinutesAsClock } from "../lib/time";
import { EditStepDialog } from "./EditStepDialog";
import { PriorityBadge } from "./PriorityBadge";
import { formatElapsedSeconds, getTrackedSeconds } from "./timer";
import { runWithErrorToast } from "./toasts";

type PendingAction = "done" | "timer" | "move" | "delete" | null;

/**
 * One step of a plan: time range, description, task, done checkbox and timer.
 * With `editable`, also move up/down, edit and delete controls.
 */
export function StepRow({
  step,
  index,
  stepCount,
  editable = false,
}: {
  step: PlanStep;
  index: number;
  stepCount: number;
  editable?: boolean;
}) {
  const [pending, setPending] = useState<PendingAction>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const isTimerRunning = step.timerStartedAt !== null;
  const now = useNow(1000, isTimerRunning);
  const trackedSeconds = getTrackedSeconds(step, now);
  const endMinute = step.startMinute + step.plannedMinutes;
  const timeRange = `${formatMinutesAsClock(step.startMinute)}–${formatMinutesAsClock(
    endMinute,
  )}`;

  const run = async (
    action: Exclude<PendingAction, null>,
    fn: () => Promise<unknown>,
    errorTitle: string,
  ) => {
    setPending(action);
    await runWithErrorToast(fn, errorTitle);
    setPending(null);
  };

  const handleToggleDone = (checked: boolean | "indeterminate") =>
    run(
      "done",
      () => updatePlanStep({ id: step.id, isDone: checked === true }),
      "Couldn't update step",
    );

  const handleToggleTimer = () =>
    run(
      "timer",
      () =>
        isTimerRunning
          ? stopStepTimer({ id: step.id })
          : startStepTimer({ id: step.id }),
      isTimerRunning ? "Couldn't stop timer" : "Couldn't start timer",
    );

  const handleMove = (toIndex: number) =>
    run(
      "move",
      () => reorderPlanStep({ id: step.id, toIndex }),
      "Couldn't move step",
    );

  const handleDelete = () => {
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }
    setIsConfirmingDelete(false);
    void run(
      "delete",
      () => deletePlanStep({ id: step.id }),
      "Couldn't delete step",
    );
  };

  const isBusy = pending !== null;
  const checkboxId = `step-done-${step.id}`;

  return (
    <li
      className={cn(
        "bg-card flex flex-wrap items-start gap-x-3 gap-y-2 rounded-lg border p-3 transition-colors sm:flex-nowrap",
        isTimerRunning && "border-primary/60 bg-primary/5",
        step.isDone && "opacity-70",
      )}
    >
      <Checkbox
        id={checkboxId}
        checked={step.isDone}
        disabled={pending === "done"}
        onCheckedChange={handleToggleDone}
        className="mt-1"
        aria-label={step.isDone ? "Mark step as not done" : "Mark step as done"}
      />
      <div className="min-w-0 flex-1">
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="text-foreground font-mono font-medium tabular-nums">
            {timeRange}
          </span>
          <span aria-hidden="true">·</span>
          <span>{formatDuration(step.plannedMinutes)}</span>
          {(trackedSeconds > 0 || isTimerRunning) && (
            <>
              <span aria-hidden="true">·</span>
              <span
                className={cn(
                  "tabular-nums",
                  isTimerRunning && "text-primary font-medium",
                )}
              >
                {isTimerRunning
                  ? `⏱ ${formatElapsedSeconds(trackedSeconds)}`
                  : `${formatDuration(trackedSeconds / 60)} tracked`}
              </span>
            </>
          )}
        </div>
        <label
          htmlFor={checkboxId}
          className={cn(
            "text-foreground mt-1 block cursor-pointer text-sm leading-snug break-words",
            step.isDone && "text-muted-foreground line-through",
          )}
        >
          {step.description}
        </label>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground truncate text-xs">
            {step.taskName}
          </span>
          <PriorityBadge priority={step.taskPriority} />
        </div>
      </div>

      <div className="flex w-full items-center justify-end gap-0.5 sm:w-auto sm:shrink-0">
        <Button
          type="button"
          size="icon"
          variant={isTimerRunning ? "default" : "ghost"}
          className="size-8"
          onClick={handleToggleTimer}
          disabled={isBusy || (step.isDone && !isTimerRunning)}
          aria-label={isTimerRunning ? "Stop timer" : "Start timer"}
          title={isTimerRunning ? "Stop timer" : "Start timer"}
        >
          {pending === "timer" ? (
            <Loader2 className="animate-spin" />
          ) : isTimerRunning ? (
            <Square />
          ) : (
            <Play />
          )}
        </Button>
        {editable && (
          <>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={() => handleMove(index - 1)}
              disabled={isBusy || index === 0}
              aria-label="Move step up"
              title="Move up"
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={() => handleMove(index + 1)}
              disabled={isBusy || index >= stepCount - 1}
              aria-label="Move step down"
              title="Move down"
            >
              <ArrowDown />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={() => setIsEditOpen(true)}
              disabled={isBusy}
              aria-label="Edit step"
              title="Edit"
            >
              <Pencil />
            </Button>
            <Button
              type="button"
              size={isConfirmingDelete ? "sm" : "icon"}
              variant={isConfirmingDelete ? "destructive" : "ghost"}
              className={cn(
                "h-8",
                isConfirmingDelete ? "px-2" : "text-destructive w-8",
              )}
              onClick={handleDelete}
              onBlur={() => setIsConfirmingDelete(false)}
              disabled={isBusy}
              aria-label={
                isConfirmingDelete ? "Confirm delete step" : "Delete step"
              }
              title="Delete"
            >
              {pending === "delete" ? (
                <Loader2 className="animate-spin" />
              ) : isConfirmingDelete ? (
                "Delete?"
              ) : (
                <Trash2 />
              )}
            </Button>
            <EditStepDialog
              step={step}
              open={isEditOpen}
              onOpenChange={setIsEditOpen}
            />
          </>
        )}
      </div>
    </li>
  );
}
