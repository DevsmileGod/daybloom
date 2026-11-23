import { Loader2 } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { updateWorkspaceTask } from "wasp/client/operations";
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
import { getErrorMessage } from "../../client/errors";
import type {
  WorkspaceMemberDetails,
  WorkspaceTaskDetails,
} from "../operations";
import { AssigneeSelect } from "./AssigneeSelect";
import { getUserLabel, isValidHours } from "./format";

export function EditWorkspaceTaskDialog({
  open,
  onOpenChange,
  task,
  members,
  myUserId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: WorkspaceTaskDetails;
  members: WorkspaceMemberDetails[];
  myUserId: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Mounted only while open, so the form starts from the latest task. */}
        {open && (
          <EditWorkspaceTaskForm
            task={task}
            members={members}
            myUserId={myUserId}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditWorkspaceTaskForm({
  task,
  members,
  myUserId,
  onDone,
}: {
  task: WorkspaceTaskDetails;
  members: WorkspaceMemberDetails[];
  myUserId: string;
  onDone: () => void;
}) {
  const formId = useId();
  const [description, setDescription] = useState(task.description);
  const [hours, setHours] = useState(task.time);
  const [assigneeId, setAssigneeId] = useState<string | null>(task.assigneeId);
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hoursInvalid = !isValidHours(hours);
  const canSubmit = description.trim().length > 0 && !hoursInvalid;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || isPending) return;
    setIsPending(true);
    setError(null);
    try {
      await updateWorkspaceTask({
        id: task.id,
        description: description.trim(),
        time: hours.trim(),
        assigneeId,
        dueDate: dueDate || null,
      });
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Edit task</DialogTitle>
        <DialogDescription>
          Changes are visible to everyone in the team.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor={`${formId}-description`}>Description</Label>
        <Textarea
          id={`${formId}-description`}
          value={description}
          maxLength={500}
          rows={3}
          onChange={(event) => setDescription(event.currentTarget.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
            aria-invalid={hoursInvalid}
            onChange={(event) => setHours(event.currentTarget.value)}
          />
          {hoursInvalid && (
            <p className="text-destructive text-sm">
              Enter between 0 and 24 hours
            </p>
          )}
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
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${formId}-assignee`}>Assignee</Label>
        <AssigneeSelect
          id={`${formId}-assignee`}
          value={assigneeId}
          onChange={setAssigneeId}
          members={members}
          myUserId={myUserId}
          formerMemberLabel={
            task.assignee ? getUserLabel(task.assignee) : undefined
          }
        />
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <DialogFooter className="gap-2 sm:gap-0">
        <Button
          type="button"
          variant="outline"
          onClick={onDone}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit || isPending}>
          {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Save changes
        </Button>
      </DialogFooter>
    </form>
  );
}
