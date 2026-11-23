import { Loader2 } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { renameWorkspace } from "wasp/client/operations";
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

export function RenameWorkspaceDialog({
  open,
  onOpenChange,
  workspaceId,
  currentName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  currentName: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <RenameWorkspaceForm
            workspaceId={workspaceId}
            currentName={currentName}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RenameWorkspaceForm({
  workspaceId,
  currentName,
  onDone,
}: {
  workspaceId: string;
  currentName: string;
  onDone: () => void;
}) {
  const inputId = useId();
  const [name, setName] = useState(currentName);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const canSubmit =
    trimmedName.length > 0 && trimmedName !== currentName && !isPending;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setIsPending(true);
    setError(null);
    try {
      await renameWorkspace({ id: workspaceId, name: trimmedName });
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
        <DialogTitle>Rename team</DialogTitle>
        <DialogDescription>
          The new name is shown to every member.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor={inputId}>Team name</Label>
        <Input
          id={inputId}
          value={name}
          maxLength={80}
          autoFocus
          onChange={(event) => setName(event.currentTarget.value)}
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
        <Button type="submit" disabled={!canSubmit}>
          {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}
