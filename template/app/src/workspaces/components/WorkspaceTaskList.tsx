import { ListTodo } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../client/components/ui/card";
import { getTodayDateKey } from "../../planner/lib/dates";
import type {
  WorkspaceMemberDetails,
  WorkspaceTaskDetails,
} from "../operations";
import { AddWorkspaceTaskForm } from "./AddWorkspaceTaskForm";
import { WorkspaceTaskRow } from "./WorkspaceTaskRow";

type TaskFilter = "all" | "mine" | "unassigned" | "done";

const FILTERS: { value: TaskFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "mine", label: "Assigned to me" },
  { value: "unassigned", label: "Unassigned" },
  { value: "done", label: "Done" },
];

const EMPTY_MESSAGES: Record<TaskFilter, string> = {
  all: "No shared tasks yet. Add the first one above.",
  mine: "Nothing open is assigned to you right now.",
  unassigned: "Every open task has someone on it.",
  done: "No finished tasks yet.",
};

function matchesFilter(
  task: WorkspaceTaskDetails,
  filter: TaskFilter,
  myUserId: string,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "mine":
      return !task.isDone && task.assigneeId === myUserId;
    case "unassigned":
      return !task.isDone && task.assigneeId === null;
    case "done":
      return task.isDone;
  }
}

export function WorkspaceTaskList({
  workspaceId,
  tasks,
  members,
  myUserId,
  myRole,
}: {
  workspaceId: string;
  tasks: WorkspaceTaskDetails[];
  members: WorkspaceMemberDetails[];
  myUserId: string;
  myRole: string;
}) {
  const [filter, setFilter] = useState<TaskFilter>("all");
  const todayKey = getTodayDateKey();

  const counts = useMemo(() => {
    const result: Record<TaskFilter, number> = {
      all: 0,
      mine: 0,
      unassigned: 0,
      done: 0,
    };
    for (const task of tasks) {
      for (const { value } of FILTERS) {
        if (matchesFilter(task, value, myUserId)) result[value] += 1;
      }
    }
    return result;
  }, [tasks, myUserId]);

  const visibleTasks = useMemo(
    () => tasks.filter((task) => matchesFilter(task, filter, myUserId)),
    [tasks, filter, myUserId],
  );

  const openCount = tasks.length - counts.done;

  return (
    <Card className="hover:shadow">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2 text-lg">
          <ListTodo className="text-primary h-5 w-5" aria-hidden="true" />
          Shared tasks
        </CardTitle>
        <CardDescription>
          {openCount === 0
            ? "Nothing open right now."
            : `${openCount} open ${openCount === 1 ? "task" : "tasks"}.`}{" "}
          Use “Add to my plan” to pull a task into your own AI-generated
          schedule.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <AddWorkspaceTaskForm
          workspaceId={workspaceId}
          members={members}
          myUserId={myUserId}
        />

        <div
          role="group"
          aria-label="Filter tasks"
          className="flex flex-wrap gap-2"
        >
          {FILTERS.map(({ value, label }) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={filter === value ? "default" : "outline"}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
              <span
                className={
                  filter === value
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground"
                }
              >
                {counts[value]}
              </span>
            </Button>
          ))}
        </div>

        {visibleTasks.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
            {EMPTY_MESSAGES[filter]}
          </div>
        ) : (
          <ul className="space-y-2" aria-label="Shared tasks">
            {visibleTasks.map((task) => (
              <WorkspaceTaskRow
                key={task.id}
                task={task}
                members={members}
                myUserId={myUserId}
                myRole={myRole}
                todayKey={todayKey}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
