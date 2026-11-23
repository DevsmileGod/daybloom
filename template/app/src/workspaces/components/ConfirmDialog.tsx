import { Loader2 } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
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

/**
 * A confirmation dialog for destructive actions. Errors thrown by `onConfirm`
 * are shown inside the dialog, so server messages (e.g. "a workspace needs at
 * least one owner") reach the user. When `confirmationText` is set, the user
 * has to type it before the confirm button is enabled.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = true,
  confirmationText,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  destructive?: boolean;
  confirmationText?: string;
}) {
  const inputId = useId();
  const [typedText, setTypedText] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmationValid =
    !confirmationText || typedText.trim() === confirmationText.trim();

  const handleOpenChange = (nextOpen: boolean) => {
    if (isPending) return;
    if (!nextOpen) {
      setTypedText("");
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isConfirmationValid || isPending) return;
    setIsPending(true);
    setError(null);
    try {
      await onConfirm();
      setTypedText("");
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription asChild>
              <div>{description}</div>
            </DialogDescription>
          </DialogHeader>

          {confirmationText && (
            <div className="grid gap-2">
              <Label htmlFor={inputId}>
                Type{" "}
                <span className="text-foreground font-semibold">
                  {confirmationText}
                </span>{" "}
                to confirm
              </Label>
              <Input
                id={inputId}
                value={typedText}
                onChange={(event) => setTypedText(event.currentTarget.value)}
                autoComplete="off"
                autoFocus
              />
            </div>
          )}

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={destructive ? "destructive" : "default"}
              disabled={!isConfirmationValid || isPending}
            >
              {isPending && (
                <Loader2 className="animate-spin" aria-hidden="true" />
              )}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
