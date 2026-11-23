/** A readable message for anything thrown by a Wasp operation. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return "Something went wrong";
}

/** The HTTP status code of a failed Wasp operation, if there is one. */
export function getStatusCode(error: unknown): number | undefined {
  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }
  return undefined;
}

/** Wasp returns 402 when a user without a subscription runs out of credits. */
export function isOutOfCreditsError(error: unknown): boolean {
  return getStatusCode(error) === 402;
}
