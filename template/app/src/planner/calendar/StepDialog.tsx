import { ExternalLink, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { updatePlanStep } from "wasp/client/operations";
import { Link, routes } from "wasp/client/router";
import type { PlanStep } from "wasp/entities";
import { Button } from "../../client/components/ui/button";
import { Checkbox } from "../../client/components/ui/checkbox";
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
import { getErrorMessage } from "../../client/errors";
import { toast } from "../../client/hooks/use-toast";
import { formatDateKey } from "../lib/dates";
import { formatMinutesAsClock, MINUTES_PER_DAY, parseClock } from "../lib/time";

const MAX_DESCRIPTION_LENGTH = 500;

interface StepChanges {
  id: string;
  description?: string;
  startMinute?: number;
  plannedMinutes?: number;
  isDone?: boolean;
}

interface StepDialogProps {
  /** The step to edit; the dialog is closed when null. */
  step: PlanStep | null;
  /** Day of the step's plan, shown in the description. */
  date: string | null;
  onOpenChange: (open: boolean) => void;
}

export function StepDialog({ step, date, onOpenChange }: StepDialogProps) {
  return (
    <Dialog open={step !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {step && (
          <StepEditForm
            key={step.id}
            step={step}
            date={date}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function StepEditForm({
  step,
  date,
  onDone,
}: {
  step: PlanStep;
  date: string | null;
  onDone: () => void;
}) {
  const [description, setDescription] = useState(step.description);
  const [startTime, setStartTime] = useState(
    formatMinutesAsClock(step.startMinute),
  );
  const [duration, setDuration] = useState(String(step.plannedMinutes));
  const [isDone, setIsDone] = useState(step.isDone);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedDescription = description.trim();
    const startMinute = parseClock(startTime);
    const plannedMinutes = Number(duration);

    if (trimmedDescription.length === 0) {
      setError("Add a description.");
      return;
    }
    if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
      setError(
        `Keep the description under ${MAX_DESCRIPTION_LENGTH} characters.`,
      );
      return;
    }
    if (startMinute === null) {
      setError("Enter the start time as HH:MM, e.g. 09:30.");
      return;
    }
    if (
      !Number.isInteger(plannedMinutes) ||
      plannedMinutes < 1 ||
      plannedMinutes > MINUTES_PER_DAY
    ) {
      setError("Duration must be a whole number of minutes (1–1440).");
      return;
    }

    const changes: StepChanges = { id: step.id };
    if (trimmedDescription !== step.description) {
      changes.description = trimmedDescription;
    }
    if (startMinute !== step.startMinute) changes.startMinute = startMinute;
    if (plannedMinutes !== step.plannedMinutes) {
      changes.plannedMinutes = plannedMinutes;
    }
    if (isDone !== step.isDone) changes.isDone = isDone;

    if (Object.keys(changes).length === 1) {
      onDone();
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await updatePlanStep(changes);
      toast({ title: "Step updated" });
      onDone();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  const fieldId = (name: string) => `step-${step.id}-${name}`;

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Edit step</DialogTitle>
        <DialogDescription>
          {step.taskName}
          {date ? ` · ${formatDateKey(date)}` : ""} ·{" "}
          <span className="capitalize">{step.taskPriority}</span> priority
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor={fieldId("description")}>Description</Label>
        <Textarea
          id={fieldId("description")}
          value={description}
          maxLength={MAX_DESCRIPTION_LENGTH}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor={fieldId("start")}>Start time</Label>
          <Input
            id={fieldId("start")}
            type="time"
            step={300}
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={fieldId("duration")}>Duration (minutes)</Label>
          <Input
            id={fieldId("duration")}
            type="number"
            inputMode="numeric"
            min={1}
            max={MINUTES_PER_DAY}
            step={5}
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            required
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id={fieldId("done")}
          checked={isDone}
          onCheckedChange={(checked) => setIsDone(checked === true)}
        />
        <Label htmlFor={fieldId("done")}>Done</Label>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <DialogFooter className="gap-2 sm:items-center sm:justify-between">
        <Button asChild variant="link" className="px-0">
          <Link to={routes.PlanDetailRoute.to} params={{ planId: step.planId }}>
            Open plan <ExternalLink />
          </Link>
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}
