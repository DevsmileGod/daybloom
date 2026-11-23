import { Loader2, Plus, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import {
  createPlanTemplate,
  updatePlanTemplate,
} from "wasp/client/operations";
import type { PlanTemplate, PlanTemplateItem } from "wasp/entities";
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
import { getErrorMessage } from "../../client/errors";
import { toast } from "../../client/hooks/use-toast";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_TEMPLATE_ITEMS,
  MAX_TEMPLATE_NAME_LENGTH,
  validateDescription,
  validateHours,
} from "./validation";

export type TemplateWithItems = PlanTemplate & { items: PlanTemplateItem[] };

/** What the editor is open for: a new template, or an existing one. */
export type TemplateEditorTarget =
  | { mode: "create" }
  | { mode: "edit"; template: TemplateWithItems };

interface TemplateEditorDialogProps {
  target: TemplateEditorTarget | null;
  onOpenChange: (open: boolean) => void;
}

export function TemplateEditorDialog({
  target,
  onOpenChange,
}: TemplateEditorDialogProps) {
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {target && (
          <TemplateEditorForm
            key={target.mode === "edit" ? target.template.id : "create"}
            target={target}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ItemRow {
  key: number;
  description: string;
  time: string;
}

function TemplateEditorForm({
  target,
  onDone,
}: {
  target: TemplateEditorTarget;
  onDone: () => void;
}) {
  const nextKeyRef = useRef(0);
  const newRow = (description = "", time = "1"): ItemRow => ({
    key: nextKeyRef.current++,
    description,
    time,
  });

  const [name, setName] = useState(
    target.mode === "edit" ? target.template.name : "",
  );
  const [rows, setRows] = useState<ItemRow[]>(() =>
    target.mode === "edit" && target.template.items.length > 0
      ? target.template.items.map((item) => newRow(item.description, item.time))
      : [newRow()],
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const updateRow = (key: number, changes: Partial<Omit<ItemRow, "key">>) =>
    setRows((previous) =>
      previous.map((row) => (row.key === key ? { ...row, ...changes } : row)),
    );
  const removeRow = (key: number) =>
    setRows((previous) => previous.filter((row) => row.key !== key));
  const addRow = () => setRows((previous) => [...previous, newRow()]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      setError("Give the template a name.");
      return;
    }
    if (trimmedName.length > MAX_TEMPLATE_NAME_LENGTH) {
      setError(
        `Keep the name under ${MAX_TEMPLATE_NAME_LENGTH} characters.`,
      );
      return;
    }

    // Rows left completely blank are ignored.
    const filledRows = rows.filter((row) => row.description.trim() !== "");
    if (filledRows.length === 0) {
      setError("Add at least one task.");
      return;
    }
    for (const [index, row] of rows.entries()) {
      if (row.description.trim() === "") continue;
      const rowError =
        validateDescription(row.description) ?? validateHours(row.time);
      if (rowError) {
        setError(`Task ${index + 1}: ${rowError}`);
        return;
      }
    }
    const items = filledRows.map((row) => ({
      description: row.description.trim(),
      time: row.time.trim(),
    }));

    setError(null);
    setIsSaving(true);
    try {
      if (target.mode === "edit") {
        await updatePlanTemplate({
          id: target.template.id,
          name: trimmedName,
          items,
        });
        toast({ title: "Template updated" });
      } else {
        await createPlanTemplate({ name: trimmedName, items });
        toast({ title: "Template created" });
      }
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
        <DialogTitle>
          {target.mode === "edit" ? "Edit template" : "New template"}
        </DialogTitle>
        <DialogDescription>
          A template is a reusable set of tasks, like "Monday admin" or "Deep
          work day". Using it adds its tasks to your task list.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="template-name">Name</Label>
        <Input
          id="template-name"
          value={name}
          maxLength={MAX_TEMPLATE_NAME_LENGTH}
          placeholder="e.g. Monday admin"
          onChange={(event) => setName(event.target.value)}
          disabled={isSaving}
        />
      </div>

      <fieldset className="grid gap-2" disabled={isSaving}>
        <legend className="mb-2 text-sm font-medium">Tasks</legend>
        <div
          aria-hidden="true"
          className="text-muted-foreground hidden grid-cols-[1fr_6rem_2.25rem] gap-2 text-xs sm:grid"
        >
          <span>Description</span>
          <span>Hours</span>
        </div>
        <ul className="grid gap-2">
          {rows.map((row, index) => (
            <li
              key={row.key}
              className="grid grid-cols-[1fr_5rem_2.25rem] gap-2 sm:grid-cols-[1fr_6rem_2.25rem]"
            >
              <Input
                aria-label={`Task ${index + 1} description`}
                value={row.description}
                maxLength={MAX_DESCRIPTION_LENGTH}
                placeholder="Task description"
                onChange={(event) =>
                  updateRow(row.key, { description: event.target.value })
                }
              />
              <Input
                aria-label={`Task ${index + 1} hours`}
                type="number"
                inputMode="decimal"
                min={0.25}
                max={24}
                step={0.25}
                value={row.time}
                onChange={(event) =>
                  updateRow(row.key, { time: event.target.value })
                }
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Remove task ${index + 1}`}
                onClick={() => removeRow(row.key)}
                disabled={rows.length <= 1}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            disabled={rows.length >= MAX_TEMPLATE_ITEMS}
          >
            <Plus /> Add task
          </Button>
          {rows.length >= MAX_TEMPLATE_ITEMS && (
            <span className="text-muted-foreground ml-3 text-xs">
              A template can have up to {MAX_TEMPLATE_ITEMS} tasks.
            </span>
          )}
        </div>
      </fieldset>

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
          {target.mode === "edit" ? "Save changes" : "Create template"}
        </Button>
      </DialogFooter>
    </form>
  );
}
