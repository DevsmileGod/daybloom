import { Loader2, Plus } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { createWorkspaceTask } from "wasp/client/operations";
import { Button } from "../../client/components/ui/button";
import { Input } from "../../client/components/ui/input";
import { Label } from "../../client/components/ui/label";
import { getErrorMessage } from "../../client/errors";
import { toast } from "../../client/hooks/use-toast";
import type { WorkspaceMemberDetails } from "../operations";
import { AssigneeSelect } from "./AssigneeSelect";
import { isValidHours } from "./format";

export function AddWorkspaceTaskForm({
  workspaceId,
  members,
  myUserId,
}: {
  workspaceId: string;
  members: WorkspaceMemberDetails[];
  myUserId: string;
}) {
  const formId = useId();
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("1");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [isPending, setIsPending] = useState(false);

  const hoursError =
    hours.trim() && !isValidHours(hours)
      ? "Enter between 0 and 24 hours"
      : null;
  const canSubmit =
    description.trim().length > 0 && isValidHours(hours) && !isPending;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setIsPending(true);
    try {
      await createWorkspaceTask({
        workspaceId,
        description: description.trim(),
        time: hours.trim(),
        assigneeId,
        dueDate: dueDate || null,
      });
      setDescription("");
      setHours("1");
      setAssigneeId(null);
      setDueDate("");
    } catch (err) {
      toast({
        title: "Couldn't add the task",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-muted/30 grid gap-3 rounded-lg border p-4"
      aria-label="Add a shared task"
    >
      <div className="grid gap-2">
        <Label htmlFor={`${formId}-description`}>New shared task</Label>
        <Input
          id={`${formId}-description`}
          placeholder="e.g. Prepare the quarterly report"
          value={description}
          maxLength={500}
          onChange={(event) => setDescription(event.currentTarget.value)}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-[6rem_1fr_10rem_auto] sm:items-end">
        <div className="grid gap-2">
          <Label htmlFor={`${formId}-hours`}>Hours</Label>
          <Input
            id={`${formId}-hours`}
            type="number"
            inputMode="decimal"
            min={0.25}
            max={24}
            step={0.25}
            value={hours}
            aria-invalid={!!hoursError}
            aria-describedby={hoursError ? `${formId}-hours-error` : undefined}
            onChange={(event) => setHours(event.currentTarget.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${formId}-assignee`}>Assignee</Label>
          <AssigneeSelect
            id={`${formId}-assignee`}
            value={assigneeId}
            onChange={setAssigneeId}
            members={members}
            myUserId={myUserId}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${formId}-due`}>Due date</Label>
          <Input
            id={`${formId}-due`}
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.currentTarget.value)}
          />
        </div>
        <Button type="submit" disabled={!canSubmit}>
          {isPending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Plus aria-hidden="true" />
          )}
          Add task
        </Button>
      </div>
      {hoursError && (
        <p id={`${formId}-hours-error`} className="text-destructive text-sm">
          {hoursError}
        </p>
      )}
    </form>
  );
}
