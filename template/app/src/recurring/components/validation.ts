export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_TEMPLATE_NAME_LENGTH = 100;
export const MAX_TEMPLATE_ITEMS = 30;

/** Mirrors the server check for hour strings like "1" or "0.5". */
export function validateHours(value: string): string | null {
  const hours = Number.parseFloat(value.trim());
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
    return "Time must be between 0 and 24 hours, e.g. 1 or 0.5.";
  }
  return null;
}

export function validateDescription(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "Add a description.";
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    return `Keep the description under ${MAX_DESCRIPTION_LENGTH} characters.`;
  }
  return null;
}
