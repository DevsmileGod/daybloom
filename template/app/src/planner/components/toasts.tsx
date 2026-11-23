import { ArrowRight } from "lucide-react";
import { Link, routes } from "wasp/client/router";
import { ToastAction } from "../../client/components/ui/toast";
import { getErrorMessage, isOutOfCreditsError } from "../../client/errors";
import { toast } from "../../client/hooks/use-toast";

export function showOutOfCreditsToast() {
  toast({
    title: "⚠️ You are out of credits!",
    description: "Buy credits or subscribe to keep generating plans.",
    action: (
      <ToastAction
        altText="Go to pricing page to buy credits/subscription"
        asChild
      >
        <Link to={routes.PricingPageRoute.to}>
          Go to pricing page <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </ToastAction>
    ),
  });
}

/** Shows a destructive toast for a failed operation. */
export function showErrorToast(error: unknown, title = "Error") {
  toast({
    title,
    description: getErrorMessage(error),
    variant: "destructive",
  });
}

/**
 * Like `showErrorToast`, but shows the out-of-credits toast for 402 errors.
 * Use for operations that cost credits.
 */
export function showPaidActionErrorToast(error: unknown, title = "Error") {
  if (isOutOfCreditsError(error)) {
    showOutOfCreditsToast();
  } else {
    showErrorToast(error, title);
  }
}

/**
 * Runs an operation and shows an error toast if it fails.
 * Resolves to the result, or `undefined` on failure.
 */
export async function runWithErrorToast<T>(
  operation: () => Promise<T>,
  errorTitle = "Error",
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    showErrorToast(error, errorTitle);
    return undefined;
  }
}
