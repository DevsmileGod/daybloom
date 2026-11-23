import { Moon, Sun, Sunrise } from "lucide-react";
import type { ReactNode } from "react";
import type { PlanStep } from "wasp/entities";
import { StepRow } from "./StepRow";

interface DayPeriod {
  label: string;
  icon: ReactNode;
}

const MORNING: DayPeriod = { label: "Morning", icon: <Sunrise /> };
const AFTERNOON: DayPeriod = { label: "Afternoon", icon: <Sun /> };
const EVENING: DayPeriod = { label: "Evening", icon: <Moon /> };

function getDayPeriod(startMinute: number): DayPeriod {
  if (startMinute < 12 * 60) return MORNING;
  if (startMinute < 17 * 60) return AFTERNOON;
  return EVENING;
}

interface StepGroup {
  period: DayPeriod;
  items: { step: PlanStep; index: number }[];
}

/** Splits steps (in plan order) into consecutive morning/afternoon/evening runs. */
function groupStepsByPeriod(steps: PlanStep[]): StepGroup[] {
  const groups: StepGroup[] = [];
  steps.forEach((step, index) => {
    const period = getDayPeriod(step.startMinute);
    const last = groups.at(-1);
    if (last && last.period === period) {
      last.items.push({ step, index });
    } else {
      groups.push({ period, items: [{ step, index }] });
    }
  });
  return groups;
}

/**
 * The steps of a plan in order, visually grouped by part of the day.
 * `steps` must be in plan order (as returned by the plan queries).
 */
export function StepList({
  steps,
  editable = false,
}: {
  steps: PlanStep[];
  editable?: boolean;
}) {
  const groups = groupStepsByPeriod(steps);

  return (
    <div className="space-y-5">
      {groups.map((group, groupIndex) => (
        <section
          key={`${group.period.label}-${groupIndex}`}
          aria-label={group.period.label}
        >
          <h3 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide [&_svg]:size-3.5">
            {group.period.icon}
            {group.period.label}
          </h3>
          <ol className="space-y-2">
            {group.items.map(({ step, index }) => (
              <StepRow
                key={step.id}
                step={step}
                index={index}
                stepCount={steps.length}
                editable={editable}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
