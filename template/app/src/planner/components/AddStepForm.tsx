import { Loader2, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { addPlanStep } from "wasp/client/operations";
import { Button } from "../../client/components/ui/button";
import { Input } from "../../client/components/ui/input";
import { Label } from "../../client/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../client/components/ui/select";
import type { TaskPriority } from "../../demo-ai-app/schedule";
import { isTaskPriority, PRIORITIES } from "../lib/scheduling";
import { MINUTES_PER_DAY, parseClock } from "../lib/time";
import { getPriorityLabel } from "./PriorityBadge";
import { showErrorToast } from "./toasts";

const DEFAULT_MINUTES = "30";

/**
 * Collapsible form for adding a manual step to a plan. Without a start time
 * the step goes right after the last one.
 */
export function AddStepForm({ planId }: { planId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [taskName, setTaskName] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [startTime, setStartTime] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const parsedMinutes = Number.parseInt(minutes, 10);
  const parsedStart = startTime === "" ? undefined : parseClock(startTime);
  const isValid =
    description.trim().length > 0 &&
    Number.isInteger(parsedMinutes) &&
    parsedMinutes >= 1 &&
    parsedMinutes <= MINUTES_PER_DAY &&
    parsedStart !== null;

  const reset = () => {
    setDescription("");
    setMinutes(DEFAULT_MINUTES);
    setStartTime("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid || parsedStart === null) return;
    setIsSaving(true);
    try {
      await addPlanStep({
        planId,
        description: description.trim(),
        plannedMinutes: parsedMinutes,
        taskName: taskName.trim() === "" ? undefined : taskName.trim(),
        taskPriority: priority,
        startMinute: parsedStart,
      });
      reset();
    } catch (error) {
      showErrorToast(error, "Couldn't add step");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) {
    return (
      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed"
        onClick={() => setIsOpen(true)}
      >
        <Plus /> Add step
      </Button>
    );
  }

  const idPrefix = `add-step-${planId}`;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-muted/30 space-y-4 rounded-lg border border-dashed p-4"
      aria-label="Add a step"
    >
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-description`}>What will you do?</Label>
        <Input
          id={`${idPrefix}-description`}
          value={description}
          maxLength={500}
          placeholder="e.g. Review pull requests"
          onChange={(event) => setDescription(event.currentTarget.value)}
          autoFocus
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-minutes`}>Minutes</Label>
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
          <Label htmlFor={`${idPrefix}-start`}>Start (optional)</Label>
          <Input
            id={`${idPrefix}-start`}
            type="time"
            step={300}
            value={startTime}
            onChange={(event) => setStartTime(event.currentTarget.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-task`}>Task (optional)</Label>
          <Input
            id={`${idPrefix}-task`}
            value={taskName}
            maxLength={200}
            placeholder="Extra"
            onChange={(event) => setTaskName(event.currentTarget.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-priority`}>Priority</Label>
          <Select
            value={priority}
            onValueChange={(value) => {
              if (isTaskPriority(value)) setPriority(value);
            }}
          >
            <SelectTrigger id={`${idPrefix}-priority`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((option) => (
                <SelectItem key={option} value={option}>
                  {getPriorityLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            reset();
            setIsOpen(false);
          }}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!isValid || isSaving}>
          {isSaving ? <Loader2 className="animate-spin" /> : <Plus />}
          Add step
        </Button>
      </div>
    </form>
  );
}
