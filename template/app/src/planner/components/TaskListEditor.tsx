import { ListTodo, Loader2, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  createTask,
  deleteTask,
  getAllTasksByUser,
  updateTask,
  useQuery,
} from "wasp/client/operations";
import type { Task } from "wasp/entities";
import { Button } from "../../client/components/ui/button";
import { Checkbox } from "../../client/components/ui/checkbox";
import { Input } from "../../client/components/ui/input";
import { Label } from "../../client/components/ui/label";
import { cn } from "../../client/utils";
import { formatDuration, hoursStringToMinutes } from "../lib/time";
import { EmptyState, ErrorState, LoadingState } from "./PageStates";
import { runWithErrorToast } from "./toasts";

/** Add, estimate, check off and delete the user's personal tasks. */
export function TaskListEditor() {
  const { data: tasks, isLoading, error } = useQuery(getAllTasksByUser);
  const [description, setDescription] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = description.trim();
    if (!trimmed) return;
    setIsAdding(true);
    const created = await runWithErrorToast(
      () => createTask({ description: trimmed }),
      "Couldn't add task",
    );
    if (created) setDescription("");
    setIsAdding(false);
  };

  const openTasks = tasks?.filter((task) => !task.isDone) ?? [];
  const openMinutes = openTasks.reduce(
    (total, task) => total + hoursStringToMinutes(task.time),
    0,
  );

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex gap-2">
        <Label htmlFor="new-task-description" className="sr-only">
          New task
        </Label>
        <Input
          id="new-task-description"
          value={description}
          placeholder="Add a task, e.g. Write the weekly report"
          onChange={(event) => setDescription(event.currentTarget.value)}
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={!description.trim() || isAdding}
          aria-label="Add task"
        >
          {isAdding ? <Loader2 className="animate-spin" /> : <Plus />}
          <span className="hidden sm:inline">Add</span>
        </Button>
      </form>

      {isLoading && <LoadingState label="Loading tasks…" className="py-6" />}
      {error && <ErrorState error={error} title="Couldn't load tasks" />}
      {tasks && tasks.length === 0 && (
        <EmptyState
          icon={<ListTodo />}
          title="No tasks yet"
          description="Add what you want to get done, then let AI plan your day."
          className="py-8"
        />
      )}
      {tasks && tasks.length > 0 && (
        <>
          <ul className="space-y-2">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">
            {openTasks.length} open {openTasks.length === 1 ? "task" : "tasks"}{" "}
            · about {formatDuration(openMinutes)} estimated
          </p>
        </>
      )}
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const [hours, setHours] = useState(task.time);
  const [isDeleting, setIsDeleting] = useState(false);

  // Follow changes coming from the server. Adjusting state during render
  // (instead of in an effect) avoids an extra render pass:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [syncedTime, setSyncedTime] = useState(task.time);
  if (task.time !== syncedTime) {
    setSyncedTime(task.time);
    setHours(task.time);
  }

  const commitHours = async () => {
    const parsed = Number.parseFloat(hours);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setHours(task.time);
      return;
    }
    const normalized = String(parsed);
    if (normalized === task.time) return;
    const updated = await runWithErrorToast(
      () => updateTask({ id: task.id, time: normalized }),
      "Couldn't update task",
    );
    if (!updated) setHours(task.time);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    await runWithErrorToast(
      () => deleteTask({ id: task.id }),
      "Couldn't delete task",
    );
    setIsDeleting(false);
  };

  const checkboxId = `task-done-${task.id}`;
  const hoursId = `task-hours-${task.id}`;

  return (
    <li className="bg-card flex items-center gap-3 rounded-lg border px-3 py-2">
      <Checkbox
        id={checkboxId}
        checked={task.isDone}
        onCheckedChange={(checked) =>
          runWithErrorToast(
            () => updateTask({ id: task.id, isDone: checked === true }),
            "Couldn't update task",
          )
        }
      />
      <label
        htmlFor={checkboxId}
        className={cn(
          "text-foreground min-w-0 flex-1 cursor-pointer break-words text-sm",
          task.isDone && "text-muted-foreground line-through",
        )}
      >
        {task.description}
      </label>
      <div className="flex shrink-0 items-center gap-1">
        <Label htmlFor={hoursId} className="sr-only">
          Estimated hours for {task.description}
        </Label>
        <Input
          id={hoursId}
          type="number"
          inputMode="decimal"
          min={0.25}
          max={24}
          step={0.25}
          value={hours}
          disabled={task.isDone}
          onChange={(event) => setHours(event.currentTarget.value)}
          onBlur={commitHours}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="h-8 w-16 px-2 text-center text-xs"
        />
        <span className="text-muted-foreground text-xs">h</span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-destructive hover:text-destructive size-8 shrink-0"
        onClick={handleDelete}
        disabled={isDeleting}
        aria-label={`Delete task ${task.description}`}
        title="Delete task"
      >
        {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
      </Button>
    </li>
  );
}
