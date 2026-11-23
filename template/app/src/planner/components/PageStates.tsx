import { AlertCircle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { getErrorMessage } from "../../client/errors";
import { cn } from "../../client/utils";

/** Centered spinner with a short label for a section that is loading. */
export function LoadingState({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm",
        className,
      )}
    >
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/** Inline error message for a failed query, with an optional action. */
export function ErrorState({
  error,
  title = "Something went wrong",
  action,
  className,
}: {
  error: unknown;
  title?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "border-destructive/40 bg-destructive/5 flex flex-col items-center gap-3 rounded-xl border px-6 py-10 text-center",
        className,
      )}
    >
      <AlertCircle className="text-destructive size-6" aria-hidden="true" />
      <div>
        <p className="text-foreground font-semibold">{title}</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {getErrorMessage(error)}
        </p>
      </div>
      {action}
    </div>
  );
}

/** Friendly empty state with an icon, text and an optional call to action. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full [&_svg]:size-6">
          {icon}
        </div>
      )}
      <div>
        <p className="text-foreground font-semibold">{title}</p>
        {description && (
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
