import type { DragEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { updatePlanStep } from "wasp/client/operations";
import { getErrorMessage } from "../../client/errors";
import { toast } from "../../client/hooks/use-toast";
import type { DateKey } from "../lib/dates";
import { normalizeStartMinute, type TimedStep } from "../lib/scheduling";
import { pxToMinutes, SNAP_MINUTES } from "./calendarLayout";

interface DragSource {
  step: TimedStep;
  date: DateKey;
  /** Distance from the top of the block to where it was grabbed. */
  grabOffsetPx: number;
}

export interface DropPreview {
  stepId: string;
  date: DateKey;
  startMinute: number;
  plannedMinutes: number;
  /** False when hovering another day, where the step can't be dropped. */
  isValid: boolean;
}

interface UseDragRescheduleOptions {
  /**
   * The server data the overrides apply to. When it changes, optimistic
   * values whose request has finished are dropped.
   */
  serverData: unknown;
}

/**
 * Native HTML5 drag & drop for rescheduling steps inside their own day, with
 * optimistic start times that are reverted when saving fails.
 */
export function useDragReschedule({ serverData }: UseDragRescheduleOptions) {
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null);
  const [preview, setPreview] = useState<DropPreview | null>(null);
  const dragSourceRef = useRef<DragSource | null>(null);
  /** Number of unfinished requests per step id. */
  const pendingRef = useRef(new Map<string, number>());
  /** Id of the latest request per step id, to ignore stale failures. */
  const latestRequestRef = useRef(new Map<string, number>());
  const requestCounterRef = useRef(0);

  useEffect(() => {
    setOverrides((previous) => {
      const next: Record<string, number> = {};
      let changed = false;
      for (const [stepId, startMinute] of Object.entries(previous)) {
        if (pendingRef.current.has(stepId)) {
          next[stepId] = startMinute;
        } else {
          changed = true;
        }
      }
      return changed ? next : previous;
    });
  }, [serverData]);

  const reschedule = useCallback(
    async (step: TimedStep, requestedStartMinute: number) => {
      const startMinute = normalizeStartMinute(
        requestedStartMinute,
        step.plannedMinutes,
        SNAP_MINUTES,
      );
      if (startMinute === step.startMinute) return;

      const requestId = ++requestCounterRef.current;
      latestRequestRef.current.set(step.id, requestId);
      const pending = pendingRef.current;
      pending.set(step.id, (pending.get(step.id) ?? 0) + 1);
      setOverrides((previous) => ({ ...previous, [step.id]: startMinute }));

      try {
        await updatePlanStep({ id: step.id, startMinute });
      } catch (error) {
        if (latestRequestRef.current.get(step.id) === requestId) {
          setOverrides((previous) => {
            const next = { ...previous };
            delete next[step.id];
            return next;
          });
        }
        toast({
          title: "Couldn't move the step",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      } finally {
        const remaining = (pending.get(step.id) ?? 1) - 1;
        if (remaining <= 0) {
          pending.delete(step.id);
        } else {
          pending.set(step.id, remaining);
        }
      }
    },
    [],
  );

  /** Moves a step by `deltaMinutes`, e.g. from the keyboard. */
  const nudge = useCallback(
    (step: TimedStep, deltaMinutes: number) =>
      reschedule(step, step.startMinute + deltaMinutes),
    [reschedule],
  );

  const getDropStartMinute = (
    event: DragEvent<HTMLElement>,
    source: DragSource,
    windowStartMinute: number,
  ): number => {
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetPx = event.clientY - rect.top - source.grabOffsetPx;
    return normalizeStartMinute(
      windowStartMinute + pxToMinutes(offsetPx),
      source.step.plannedMinutes,
      SNAP_MINUTES,
    );
  };

  const clearDrag = () => {
    dragSourceRef.current = null;
    setDraggingStepId(null);
    setPreview(null);
  };

  const getBlockDragProps = (step: TimedStep, date: DateKey) => ({
    draggable: true,
    onDragStart: (event: DragEvent<HTMLElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      dragSourceRef.current = {
        step,
        date,
        grabOffsetPx: event.clientY - rect.top,
      };
      event.dataTransfer.effectAllowed = "move";
      // Firefox only starts a drag when some data is set.
      event.dataTransfer.setData("text/plain", step.id);
      // Defer the state change so the browser's drag image is taken from the
      // block as it looks before we dim it.
      window.setTimeout(() => {
        if (dragSourceRef.current?.step.id === step.id) {
          setDraggingStepId(step.id);
        }
      }, 0);
    },
    onDragEnd: () => clearDrag(),
  });

  /**
   * Props for a day column of the time grid.
   * @param windowStartMinute minute of the day shown at the top of the column
   */
  const getColumnDropProps = (date: DateKey, windowStartMinute: number) => ({
    onDragOver: (event: DragEvent<HTMLElement>) => {
      const source = dragSourceRef.current;
      if (!source) return;
      // Accept the drop everywhere so a drop on another day can explain why
      // it isn't allowed instead of silently doing nothing.
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const startMinute = getDropStartMinute(event, source, windowStartMinute);
      const isValid = date === source.date;
      setPreview((previous) =>
        previous &&
        previous.date === date &&
        previous.startMinute === startMinute &&
        previous.stepId === source.step.id
          ? previous
          : {
              stepId: source.step.id,
              date,
              startMinute,
              plannedMinutes: source.step.plannedMinutes,
              isValid,
            },
      );
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      const source = dragSourceRef.current;
      if (!source) return;
      event.preventDefault();
      const startMinute = getDropStartMinute(event, source, windowStartMinute);
      clearDrag();
      if (date !== source.date) {
        toast({
          title: "Steps stay on their own day",
          description:
            "Each step belongs to that day's plan, so it can only be moved to another time on the same day.",
        });
        return;
      }
      void reschedule(source.step, startMinute);
    },
  });

  return {
    overrides,
    draggingStepId,
    preview,
    reschedule,
    nudge,
    getBlockDragProps,
    getColumnDropProps,
  };
}

export type DragReschedule = ReturnType<typeof useDragReschedule>;
