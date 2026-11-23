import { Input } from "../../client/components/ui/input";
import { Label } from "../../client/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../client/components/ui/select";
import { cn } from "../../client/utils";
import { DAY_NAMES, SHORT_DAY_NAMES } from "../../planner/lib/dates";
import {
  isRecurrenceFrequency,
  RECURRENCE_FREQUENCIES,
  validateRecurrenceRule,
  type RecurrenceFrequency,
} from "../recurrence";
import {
  MAX_DESCRIPTION_LENGTH,
  validateDescription,
  validateHours,
} from "./validation";

export interface RecurringTaskFormValues {
  description: string;
  time: string;
  frequency: RecurrenceFrequency;
  /** 0 = Sunday ... 6 = Saturday; only used for weekly tasks. */
  daysOfWeek: number[];
}

export const EMPTY_RECURRING_TASK: RecurringTaskFormValues = {
  description: "",
  time: "1",
  frequency: "daily",
  daysOfWeek: [],
};

const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  daily: "Every day",
  weekdays: "Every weekday (Mon–Fri)",
  weekly: "On specific days",
};

/** Monday first, the way most people read a week. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** First validation error of the form, or null when it can be submitted. */
export function validateRecurringTaskValues(
  values: RecurringTaskFormValues,
): string | null {
  return (
    validateDescription(values.description) ??
    validateHours(values.time) ??
    validateRecurrenceRule(values)
  );
}

/** Values as the create/update operations expect them. */
export function toRecurringTaskInput(values: RecurringTaskFormValues) {
  return {
    description: values.description.trim(),
    time: values.time.trim(),
    frequency: values.frequency,
    daysOfWeek: values.frequency === "weekly" ? values.daysOfWeek : [],
  };
}

interface RecurringTaskFieldsProps {
  values: RecurringTaskFormValues;
  onChange: (values: RecurringTaskFormValues) => void;
  /** Keeps element ids unique when the fields appear more than once. */
  idPrefix: string;
  disabled?: boolean;
}

export function RecurringTaskFields({
  values,
  onChange,
  idPrefix,
  disabled = false,
}: RecurringTaskFieldsProps) {
  const update = (changes: Partial<RecurringTaskFormValues>) =>
    onChange({ ...values, ...changes });

  const toggleDay = (day: number) =>
    update({
      daysOfWeek: values.daysOfWeek.includes(day)
        ? values.daysOfWeek.filter((selected) => selected !== day)
        : [...values.daysOfWeek, day],
    });

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-description`}>Task</Label>
          <Input
            id={`${idPrefix}-description`}
            value={values.description}
            maxLength={MAX_DESCRIPTION_LENGTH}
            placeholder="e.g. Check email"
            onChange={(event) => update({ description: event.target.value })}
            disabled={disabled}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-time`}>Hours</Label>
          <Input
            id={`${idPrefix}-time`}
            type="number"
            inputMode="decimal"
            min={0.25}
            max={24}
            step={0.25}
            value={values.time}
            onChange={(event) => update({ time: event.target.value })}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-frequency`}>Repeats</Label>
        <Select
          value={values.frequency}
          onValueChange={(value) => {
            if (isRecurrenceFrequency(value)) update({ frequency: value });
          }}
          disabled={disabled}
        >
          <SelectTrigger id={`${idPrefix}-frequency`} className="sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RECURRENCE_FREQUENCIES.map((frequency) => (
              <SelectItem key={frequency} value={frequency}>
                {FREQUENCY_LABELS[frequency]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {values.frequency === "weekly" && (
        <div className="grid gap-2">
          <span id={`${idPrefix}-days-label`} className="text-sm font-medium">
            On these days
          </span>
          <div
            role="group"
            aria-labelledby={`${idPrefix}-days-label`}
            className="flex flex-wrap gap-1.5"
          >
            {DAY_ORDER.map((day) => {
              const isSelected = values.daysOfWeek.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={DAY_NAMES[day]}
                  onClick={() => toggleDay(day)}
                  disabled={disabled}
                  className={cn(
                    "focus-visible:ring-ring h-9 min-w-12 rounded-md border px-2 text-sm font-medium transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:opacity-50",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-foreground hover:bg-muted",
                  )}
                >
                  {SHORT_DAY_NAMES[day]}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
