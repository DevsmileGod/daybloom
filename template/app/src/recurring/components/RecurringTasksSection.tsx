import { Loader2, Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  addDueRecurringTasksNow,
  createRecurringTask,
  deleteRecurringTask,
  getRecurringTasks,
  updateRecurringTask,
  useQuery,
} from "wasp/client/operations";
import type { RecurringTask } from "wasp/entities";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../client/components/ui/alert";
import { Button } from "../../client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../client/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../client/components/ui/dialog";
import { Switch } from "../../client/components/ui/switch";
import { getErrorMessage } from "../../client/errors";
import { toast } from "../../client/hooks/use-toast";
import { cn } from "../../client/utils";
import { formatDuration, hoursStringToMinutes } from "../../planner/lib/time";
import { describeRecurrence, isRecurrenceFrequency } from "../recurrence";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  EMPTY_RECURRING_TASK,
  RecurringTaskFields,
  toRecurringTaskInput,
  validateRecurringTaskValues,
  type RecurringTaskFormValues,
} from "./RecurringTaskFields";

export function RecurringTasksSection() {
  const {
    data: recurringTasks,
    isLoading,
    error,
    refetch,
  } = useQuery(getRecurringTasks);
  const [editing, setEditing] = useState<RecurringTask | null>(null);
  const [deleting, setDeleting] = useState<RecurringTask | null>(null);
  /** Optimistic "active" values while a toggle is being saved. */
  const [activeOverrides, setActiveOverrides] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    setActiveOverrides({});
  }, [recurringTasks]);

  const handleToggleActive = async (task: RecurringTask, isActive: boolean) => {
    setActiveOverrides((previous) => ({ ...previous, [task.id]: isActive }));
    try {
      await updateRecurringTask({ id: task.id, isActive });
    } catch (toggleError) {
      setActiveOverrides((previous) => {
        const next = { ...previous };
        delete next[task.id];
        return next;
      });
      toast({
        title: "Couldn't update the recurring task",
        description: getErrorMessage(toggleError),
        variant: "destructive",
      });
    }
  };

  return (
    <section aria-labelledby="recurring-tasks-heading" className="grid gap-4">
      <div>
        <h2
          id="recurring-tasks-heading"
          className="text-foreground flex items-center gap-2 text-xl font-semibold"
        >
          <Repeat className="size-5" aria-hidden="true" /> Recurring tasks
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Recurring tasks are added to your task list automatically on each day
          they're due, in your time zone. Pause one to stop it for a while
          without deleting it.
        </p>
      </div>

      <NewRecurringTaskCard />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load your recurring tasks</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{getErrorMessage(error)}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void refetch()}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : isLoading || !recurringTasks ? (
        <p
          className="text-muted-foreground flex items-center gap-2 text-sm"
          role="status"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading recurring tasks…
        </p>
      ) : recurringTasks.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          No recurring tasks yet. Add things you do regularly, like a daily
          review or a weekly report, and they'll show up on your list by
          themselves.
        </p>
      ) : (
        <ul className="bg-card divide-y rounded-xl border">
          {recurringTasks.map((task) => {
            const isActive = activeOverrides[task.id] ?? task.isActive;
            return (
              <li
                key={task.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className={cn("min-w-0", !isActive && "opacity-60")}>
                  <p className="text-foreground font-medium break-words">
                    {task.description}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {formatDuration(hoursStringToMinutes(task.time))} ·{" "}
                    {describeRecurrence(task)}
                    {!isActive && " · Paused"}
                  </p>
                </div>
                <div className="flex items-center gap-1 self-end sm:self-auto">
                  <label className="text-muted-foreground mr-2 flex items-center gap-2 text-sm">
                    <Switch
                      checked={isActive}
                      onCheckedChange={(checked) =>
                        void handleToggleActive(task, checked)
                      }
                      aria-label={`Active: ${task.description}`}
                    />
                    <span aria-hidden="true">
                      {isActive ? "Active" : "Paused"}
                    </span>
                  </label>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Edit ${task.description}`}
                    onClick={() => setEditing(task)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    aria-label={`Delete ${task.description}`}
                    onClick={() => setDeleting(task)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <EditRecurringTaskDialog
        task={editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this recurring task?"
        description={
          <>
            <span className="text-foreground font-medium">
              {deleting?.description}
            </span>{" "}
            won't be added to your list anymore. Tasks it already created stay
            on your list.
          </>
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          await deleteRecurringTask({ id: deleting.id });
          toast({ title: "Recurring task deleted" });
        }}
      />
    </section>
  );
}

function NewRecurringTaskCard() {
  const [values, setValues] =
    useState<RecurringTaskFormValues>(EMPTY_RECURRING_TASK);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateRecurringTaskValues(values);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await createRecurringTask(toRecurringTaskInput(values));
      setValues(EMPTY_RECURRING_TASK);
    } catch (createError) {
      setError(getErrorMessage(createError));
      setIsSaving(false);
      return;
    }

    try {
      const { createdTasks } = await addDueRecurringTasksNow();
      toast({
        title: "Recurring task added",
        description:
          createdTasks > 0
            ? `Added ${createdTasks} ${createdTasks === 1 ? "task" : "tasks"} to today's list.`
            : "Nothing new is due today. It will show up on the next day it's due.",
      });
    } catch {
      toast({
        title: "Recurring task added",
        description:
          "It will show up on your list within the hour on days it's due.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit} noValidate>
        <CardHeader>
          <CardTitle className="text-base">New recurring task</CardTitle>
          <CardDescription>
            If it's due today, it's added to today's list right away.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <RecurringTaskFields
            values={values}
            onChange={setValues}
            idPrefix="new-recurring"
            disabled={isSaving}
          />
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <div>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin" /> : <Plus />}
              Add recurring task
            </Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}

function EditRecurringTaskDialog({
  task,
  onOpenChange,
}: {
  task: RecurringTask | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={task !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {task && (
          <EditRecurringTaskForm
            key={task.id}
            task={task}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditRecurringTaskForm({
  task,
  onDone,
}: {
  task: RecurringTask;
  onDone: () => void;
}) {
  const [values, setValues] = useState<RecurringTaskFormValues>(() => ({
    description: task.description,
    time: task.time,
    frequency: isRecurrenceFrequency(task.frequency) ? task.frequency : "daily",
    daysOfWeek: task.daysOfWeek,
  }));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateRecurringTaskValues(values);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await updateRecurringTask({
        id: task.id,
        ...toRecurringTaskInput(values),
      });
      toast({ title: "Recurring task updated" });
      onDone();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Edit recurring task</DialogTitle>
        <DialogDescription>
          Changes apply from the next time it's due. Tasks already on your list
          aren't changed.
        </DialogDescription>
      </DialogHeader>
      <RecurringTaskFields
        values={values}
        onChange={setValues}
        idPrefix={`edit-recurring-${task.id}`}
        disabled={isSaving}
      />
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}
