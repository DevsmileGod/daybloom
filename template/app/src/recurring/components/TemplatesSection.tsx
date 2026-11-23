import {
  ClipboardCopy,
  LayoutTemplate,
  Loader2,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  applyPlanTemplate,
  createPlanTemplate,
  deletePlanTemplate,
  getPlanTemplates,
  useQuery,
} from "wasp/client/operations";
import { Link, routes } from "wasp/client/router";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../client/components/ui/alert";
import { Button } from "../../client/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
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
import { Input } from "../../client/components/ui/input";
import { Label } from "../../client/components/ui/label";
import { ToastAction } from "../../client/components/ui/toast";
import { getErrorMessage } from "../../client/errors";
import { toast } from "../../client/hooks/use-toast";
import { formatDuration, hoursStringToMinutes } from "../../planner/lib/time";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  TemplateEditorDialog,
  type TemplateEditorTarget,
  type TemplateWithItems,
} from "./TemplateEditorDialog";
import { MAX_TEMPLATE_NAME_LENGTH } from "./validation";

function pluralizeTasks(count: number): string {
  return `${count} ${count === 1 ? "task" : "tasks"}`;
}

export function TemplatesSection() {
  const {
    data: templates,
    isLoading,
    error,
    refetch,
  } = useQuery(getPlanTemplates);
  const [editorTarget, setEditorTarget] =
    useState<TemplateEditorTarget | null>(null);
  const [isSaveCurrentOpen, setIsSaveCurrentOpen] = useState(false);
  const [deleting, setDeleting] = useState<TemplateWithItems | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const handleApply = async (template: TemplateWithItems) => {
    setApplyingId(template.id);
    try {
      const { created, skipped } = await applyPlanTemplate({
        id: template.id,
      });
      toast({
        title: `Added ${pluralizeTasks(created.length)}${
          skipped > 0 ? ` (${skipped} already on your list)` : ""
        }`,
        description: `From "${template.name}".`,
        action: (
          <ToastAction altText="Open the planner" asChild>
            <Link to={routes.PlannerRoute.to}>Open planner</Link>
          </ToastAction>
        ),
      });
    } catch (applyError) {
      toast({
        title: "Couldn't use the template",
        description: getErrorMessage(applyError),
        variant: "destructive",
      });
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <section aria-labelledby="templates-heading" className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="templates-heading"
            className="text-foreground flex items-center gap-2 text-xl font-semibold"
          >
            <LayoutTemplate className="size-5" aria-hidden="true" /> Templates
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Save sets of tasks you plan often and add them to your list in one
            click. Tasks already on your list aren't added twice.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsSaveCurrentOpen(true)}
          >
            <ClipboardCopy /> Save my current tasks
          </Button>
          <Button
            type="button"
            onClick={() => setEditorTarget({ mode: "create" })}
          >
            <Plus /> New template
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load your templates</AlertTitle>
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
      ) : isLoading || !templates ? (
        <p
          className="text-muted-foreground flex items-center gap-2 text-sm"
          role="status"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading templates…
        </p>
      ) : templates.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          No templates yet. Create one from scratch, or save the tasks you have
          open right now as a template.
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {templates.map((template) => {
            const totalMinutes = template.items.reduce(
              (total, item) => total + hoursStringToMinutes(item.time),
              0,
            );
            return (
              <li key={template.id}>
                <Card className="flex h-full flex-col">
                  <CardHeader className="pb-3">
                    <CardTitle className="break-words">{template.name}</CardTitle>
                    <p className="text-muted-foreground text-sm">
                      {pluralizeTasks(template.items.length)} ·{" "}
                      {formatDuration(totalMinutes)}
                    </p>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <ul className="grid gap-1 text-sm">
                      {template.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-baseline justify-between gap-3"
                        >
                          <span className="text-foreground min-w-0 break-words">
                            {item.description}
                          </span>
                          <span className="text-muted-foreground shrink-0 tabular-nums">
                            {formatDuration(hoursStringToMinutes(item.time))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleApply(template)}
                      disabled={applyingId !== null}
                    >
                      {applyingId === template.id ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Play />
                      )}
                      Use template
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setEditorTarget({ mode: "edit", template })
                      }
                    >
                      <Pencil /> Edit
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive ml-auto size-8"
                      aria-label={`Delete template ${template.name}`}
                      onClick={() => setDeleting(template)}
                    >
                      <Trash2 />
                    </Button>
                  </CardFooter>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <TemplateEditorDialog
        target={editorTarget}
        onOpenChange={(open) => !open && setEditorTarget(null)}
      />
      <SaveCurrentTasksDialog
        open={isSaveCurrentOpen}
        onOpenChange={setIsSaveCurrentOpen}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this template?"
        description={
          <>
            <span className="text-foreground font-medium">
              {deleting?.name}
            </span>{" "}
            will be deleted. Tasks you already added from it stay on your list.
          </>
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          await deletePlanTemplate({ id: deleting.id });
          toast({ title: "Template deleted" });
        }}
      />
    </section>
  );
}

function SaveCurrentTasksDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && <SaveCurrentTasksForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function SaveCurrentTasksForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      setError("Give the template a name.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const template = await createPlanTemplate({ name: trimmedName });
      toast({
        title: "Template saved",
        description: `"${template.name}" has ${pluralizeTasks(template.items.length)}.`,
      });
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
        <DialogTitle>Save my current tasks as a template</DialogTitle>
        <DialogDescription>
          All tasks that are still open on your task list are saved, so you
          can add them again on another day.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="save-current-template-name">Template name</Label>
        <Input
          id="save-current-template-name"
          value={name}
          maxLength={MAX_TEMPLATE_NAME_LENGTH}
          placeholder="e.g. Typical Monday"
          onChange={(event) => setName(event.target.value)}
          disabled={isSaving}
          autoFocus
        />
      </div>
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
          Save template
        </Button>
      </DialogFooter>
    </form>
  );
}
