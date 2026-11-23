import { Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { updatePlanStep } from "wasp/client/operations";
import type { PlanStep } from "wasp/entities";
import { Button } from "../../client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../client/components/ui/dialog";
import { Input } from "../../client/components/ui/input";
import { Label } from "../../client/components/ui/label";
import { Textarea } from "../../client/components/ui/textarea";
import { toast } from "../../client/hooks/use-toast";
import { formatMinutesAsClock, MINUTES_PER_DAY, parseClock } from "../lib/time";
import { showErrorToast } from "./toasts";

/** Dialog for editing a step's description, duration and start time. */
export function EditStepDialog({
  step,
  open,
  onOpenChange,
}: {
  step: PlanStep;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [description, setDescription] = useState(step.description);
  const [minutes, setMinutes] = useState(String(step.plannedMinutes));
  const [startTime, setStartTime] = useState(
    formatMinutesAsClock(step.startMinute),
  );
  const [isSaving, setIsSaving] = useState(false);

  // Start from the latest values every time the dialog opens.
  useEffect(() => {
    if (open) {
      setDescription(step.description);
      setMinutes(String(step.plannedMinutes));
      setStartTime(formatMinutesAsClock(step.startMinute));
    }
  }, [open, step.description, step.plannedMinutes, step.startMinute]);

  const parsedMinutes = Number.parseInt(minutes, 10);
  const parsedStart = parseClock(startTime);
  const isValid =
    description.trim().length > 0 &&
    Number.isInteger(parsedMinutes) &&
    parsedMinutes >= 1 &&
    parsedMinutes <= MINUTES_PER_DAY &&
    parsedStart !== null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid || parsedStart === null) return;
    const trimmed = description.trim();
    setIsSaving(true);
    try {
      await updatePlanStep({
        id: step.id,
        description: trimmed !== step.description ? trimmed : undefined,
        plannedMinutes:
          parsedMinutes !== step.plannedMinutes ? parsedMinutes : undefined,
        startMinute:
          parsedStart !== step.startMinute ? parsedStart : undefined,
      });
      toast({ title: "Step updated" });
      onOpenChange(false);
    } catch (error) {
      showErrorToast(error, "Couldn't update step");
    } finally {
      setIsSaving(false);
    }
  };

  const idPrefix = `edit-step-${step.id}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] rounded-lg sm:max-w-lg">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Edit step</DialogTitle>
            <DialogDescription>
              {step.taskName} · start times snap to 5 minutes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-description`}>Description</Label>
            <Textarea
              id={`${idPrefix}-description`}
              value={description}
              maxLength={500}
              onChange={(event) => setDescription(event.currentTarget.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor={`${idPrefix}-minutes`}>Duration (minutes)</Label>
              <Input
                id={`${idPrefix}-minutes`}
                type="number"
                inputMode="numeric"
                min={1}
                max={MINUTES_PER_DAY}
                step={5}
                value={minutes}
                onChange={(event) => setMinutes(event.currentTarget.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${idPrefix}-start`}>Start time</Label>
              <Input
                id={`${idPrefix}-start`}
                type="time"
                step={300}
                value={startTime}
                onChange={(event) => setStartTime(event.currentTarget.value)}
                required
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
