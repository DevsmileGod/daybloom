import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  Clock,
  Loader2,
  Pencil,
  Trash2,
  UserRound,
} from "lucide-react";
import { useId, useState } from "react";
import {
  copyWorkspaceTaskToMyTasks,
  deleteWorkspaceTask,
  updateWorkspaceTask,
} from "wasp/client/operations";
import { Link, routes } from "wasp/client/router";
import { Button } from "../../client/components/ui/button";
import { Checkbox } from "../../client/components/ui/checkbox";
import { ToastAction } from "../../client/components/ui/toast";
import { getErrorMessage } from "../../client/errors";
import { toast } from "../../client/hooks/use-toast";
import { cn } from "../../client/utils";
import type {
  WorkspaceMemberDetails,
  WorkspaceTaskDetails,
} from "../operations";
import { canEditWorkspaceTask } from "../permissions";
import { AssigneeSelect } from "./AssigneeSelect";
import { ConfirmDialog } from "./ConfirmDialog";
import { EditWorkspaceTaskDialog } from "./EditWorkspaceTaskDialog";
import { formatDueDate, formatHours, getUserLabel, isOverdue } from "./format";

export function WorkspaceTaskRow({
  task,
  members,
  myUserId,
  myRole,
  todayKey,
}: {
  task: WorkspaceTaskDetails;
  members: WorkspaceMemberDetails[];
  myUserId: string;
  myRole: string;
  todayKey: string;
}) {
  const checkboxId = useId();
  const [isToggling, setIsToggling] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const canEdit = canEditWorkspaceTask({
    role: myRole,
    userId: myUserId,
    task,
  });
  const overdue = isOverdue(task, todayKey);

  const handleToggleDone = async (isDone: boolean) => {
    setIsToggling(true);
    try {
      await updateWorkspaceTask({ id: task.id, isDone });
    } catch (err) {
      toast({
        title: "Couldn't update the task",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsToggling(false);
    }
  };

  const handleReassign = async (assigneeId: string | null) => {
    if (assigneeId === task.assigneeId) return;
    setIsReassigning(true);
    try {
      await updateWorkspaceTask({ id: task.id, assigneeId });
    } catch (err) {
      toast({
        title: "Couldn't reassign the task",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsReassigning(false);
    }
  };

  const handleCopyToMyTasks = async () => {
    setIsCopying(true);
    try {
      await copyWorkspaceTaskToMyTasks({ id: task.id });
      toast({
        title: "Added to your tasks",
        description: "It will be included the next time you generate a plan.",
        action: (
          <ToastAction altText="Open your planner" asChild>
            <Link to={routes.PlannerRoute.to}>
              Planner <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </ToastAction>
        ),
      });
    } catch (err) {
      toast({
        title: "Couldn't add it to your plan",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsCopying(false);
    }
  };

  const handleDelete = async () => {
    await deleteWorkspaceTask({ id: task.id });
    toast({ title: "Task deleted" });
  };

  return (
    <li
      className={cn(
        "bg-card flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start",
        task.isDone && "opacity-70",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Checkbox
          id={checkboxId}
          className="mt-0.5"
          checked={task.isDone}
          disabled={isToggling}
          onCheckedChange={(checked) => handleToggleDone(checked === true)}
          aria-label={
            task.isDone
              ? `Mark "${task.description}" as not done`
              : `Mark "${task.description}" as done`
          }
        />
        <div className="min-w-0 flex-1 space-y-2">
          <label
            htmlFor={checkboxId}
            className={cn(
              "text-foreground block break-words text-sm font-medium",
              task.isDone && "text-muted-foreground line-through",
            )}
          >
            {task.description}
          </label>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">Estimated time:</span>
              {formatHours(task.time)}
            </span>
            {task.dueDate && (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  overdue &&
                    "bg-destructive/10 text-destructive rounded-full px-2 py-0.5 font-medium",
                )}
              >
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only">Due:</span>
                {formatDueDate(task.dueDate)}
                {overdue && " · overdue"}
              </span>
            )}
            {canEdit ? (
              <span className="inline-flex items-center gap-1">
                <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                <AssigneeSelect
                  value={task.assigneeId}
                  onChange={handleReassign}
                  members={members}
                  myUserId={myUserId}
                  disabled={isReassigning}
                  formerMemberLabel={
                    task.assignee ? getUserLabel(task.assignee) : undefined
                  }
                  className="h-7 w-auto min-w-[8rem] max-w-[14rem] text-xs"
                  aria-label={`Assignee for "${task.description}"`}
                />
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only">Assignee:</span>
                {task.assignee
                  ? `${getUserLabel(task.assignee)}${
                      task.assignee.id === myUserId ? " (you)" : ""
                    }`
                  : "Unassigned"}
              </span>
            )}
            <span>Added by {getUserLabel(task.createdBy)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 sm:justify-end">
        {!task.isDone && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyToMyTasks}
            disabled={isCopying}
          >
            {isCopying ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <CalendarPlus aria-hidden="true" />
            )}
            Add to my plan
          </Button>
        )}
        {canEdit && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsEditOpen(true)}
              aria-label={`Edit "${task.description}"`}
            >
              <Pencil aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => setIsDeleteOpen(true)}
              aria-label={`Delete "${task.description}"`}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </>
        )}
      </div>

      {canEdit && (
        <>
          <EditWorkspaceTaskDialog
            open={isEditOpen}
            onOpenChange={setIsEditOpen}
            task={task}
            members={members}
            myUserId={myUserId}
          />
          <ConfirmDialog
            open={isDeleteOpen}
            onOpenChange={setIsDeleteOpen}
            title="Delete this task?"
            description={
              <p>
                <span className="text-foreground font-medium">
                  {task.description}
                </span>{" "}
                will be removed for everyone in the team. Copies already added
                to personal plans are kept.
              </p>
            }
            confirmLabel="Delete task"
            onConfirm={handleDelete}
          />
        </>
      )}
    </li>
  );
}
