import {
  ChevronRight,
  GitCompareArrows,
  History,
  Search,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { getPlanById, getPlans, useQuery } from "wasp/client/operations";
import { Link, routes } from "wasp/client/router";
import { PageContainer, PageHeader } from "../client/components/PageHeader";
import { Button } from "../client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../client/components/ui/card";
import { Checkbox } from "../client/components/ui/checkbox";
import { Input } from "../client/components/ui/input";
import { Label } from "../client/components/ui/label";
import { Progress } from "../client/components/ui/progress";
import { useDebounce } from "../client/hooks/useDebounce";
import { cn } from "../client/utils";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "./components/PageStates";
import { compareDateKeys, formatDateKey } from "./lib/dates";
import { summarizeSteps, type PlanSummary } from "./lib/stats";
import { formatDuration } from "./lib/time";
import type { PlanListItem, PlanWithSteps } from "./types";

const PAGE_SIZE = 20;
const MAX_TASK_CHIPS = 4;

interface CompareSelection {
  isEnabled: boolean;
  selectedIds: string[];
  onToggle: (planId: string) => void;
}

export function PlanHistoryPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim(), 300);

  // Cursors of the loaded pages; reset whenever the search changes.
  const [pages, setPages] = useState<{
    search: string;
    cursors: (string | undefined)[];
  }>({ search: "", cursors: [undefined] });
  const cursors =
    pages.search === debouncedSearch ? pages.cursors : [undefined];
  const loadMore = (cursor: string) =>
    setPages({ search: debouncedSearch, cursors: [...cursors, cursor] });

  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelected = (planId: string) =>
    setSelectedIds((current) =>
      current.includes(planId)
        ? current.filter((id) => id !== planId)
        : current.length < 2
          ? [...current, planId]
          : current,
    );

  const toggleCompareMode = () => {
    setIsCompareMode((current) => !current);
    setSelectedIds([]);
  };

  const compare: CompareSelection = {
    isEnabled: isCompareMode,
    selectedIds,
    onToggle: toggleSelected,
  };

  return (
    <PageContainer>
      <PageHeader
        title="Plan history"
        description="Every day you've planned. Search by task, step or note."
        actions={
          <>
            <Button
              variant={isCompareMode ? "default" : "outline"}
              onClick={toggleCompareMode}
              aria-pressed={isCompareMode}
            >
              <GitCompareArrows />
              {isCompareMode ? "Done comparing" : "Compare"}
            </Button>
            <Button variant="outline" asChild>
              <Link to={routes.PlannerRoute.to}>Open planner</Link>
            </Button>
          </>
        }
      />

      <div className="relative mt-8 max-w-md">
        <Label htmlFor="plan-search" className="sr-only">
          Search plans
        </Label>
        <Search
          className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          id="plan-search"
          type="search"
          value={search}
          placeholder="Search plans…"
          maxLength={200}
          onChange={(event) => setSearch(event.currentTarget.value)}
          className="pl-9"
        />
      </div>

      {isCompareMode && (
        <div className="mt-6">
          {selectedIds.length === 2 ? (
            <PlanComparison
              idA={selectedIds[0]}
              idB={selectedIds[1]}
              onClear={() => setSelectedIds([])}
            />
          ) : (
            <p className="bg-primary/5 text-muted-foreground rounded-lg border px-4 py-3 text-sm">
              Select two plans to compare ({selectedIds.length}/2 selected).
            </p>
          )}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {cursors.map((cursor, index) => (
          <PlanListChunk
            key={cursor ?? "first"}
            cursor={cursor}
            search={debouncedSearch}
            isFirst={index === 0}
            isLast={index === cursors.length - 1}
            onLoadMore={loadMore}
            compare={compare}
          />
        ))}
      </div>
    </PageContainer>
  );
}

/** One page of the history list. The last page renders "Load more". */
function PlanListChunk({
  cursor,
  search,
  isFirst,
  isLast,
  onLoadMore,
  compare,
}: {
  cursor: string | undefined;
  search: string;
  isFirst: boolean;
  isLast: boolean;
  onLoadMore: (cursor: string) => void;
  compare: CompareSelection;
}) {
  const { data, isLoading, error, refetch } = useQuery(getPlans, {
    cursor,
    limit: PAGE_SIZE,
    search: search === "" ? undefined : search,
  });

  if (isLoading) {
    return isFirst ? (
      <LoadingState label="Loading plans…" />
    ) : (
      <LoadingState label="Loading more…" className="py-4" />
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        error={error}
        title="Couldn't load plans"
        action={
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  if (isFirst && data.plans.length === 0) {
    return search ? (
      <EmptyState
        icon={<Search />}
        title="No matching plans"
        description={`Nothing matches “${search}”. Try a task name or a word from a step.`}
      />
    ) : (
      <EmptyState
        icon={<History />}
        title="No plans yet"
        description="Generate your first plan and it will show up here."
        action={
          <Button asChild>
            <Link to={routes.PlannerRoute.to}>Plan today</Link>
          </Button>
        }
      />
    );
  }

  const { nextCursor } = data;

  return (
    <>
      <ul className="space-y-3">
        {data.plans.map((plan) => (
          <PlanRow key={plan.id} plan={plan} compare={compare} />
        ))}
      </ul>
      {isLast && nextCursor && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => onLoadMore(nextCursor)}>
            Load more
          </Button>
        </div>
      )}
    </>
  );
}

function PlanRow({
  plan,
  compare,
}: {
  plan: PlanListItem;
  compare: CompareSelection;
}) {
  const { summary } = plan;
  const percent = Math.round(summary.completionRate * 100);
  const isSelected = compare.selectedIds.includes(plan.id);
  const isSelectionFull = compare.selectedIds.length >= 2 && !isSelected;
  const checkboxId = `compare-${plan.id}`;
  const extraTaskCount = plan.taskNames.length - MAX_TASK_CHIPS;

  return (
    <li
      className={cn(
        "bg-card flex items-center gap-4 rounded-xl border p-4 transition-colors",
        isSelected && "border-primary bg-primary/5",
      )}
    >
      {compare.isEnabled && (
        <Checkbox
          id={checkboxId}
          checked={isSelected}
          disabled={isSelectionFull}
          onCheckedChange={() => compare.onToggle(plan.id)}
          aria-label={`Select plan for ${formatDateKey(plan.date)} to compare`}
        />
      )}
      <div className="bg-muted flex size-14 shrink-0 flex-col items-center justify-center rounded-lg">
        <span className="text-muted-foreground text-[11px] font-medium uppercase">
          {formatDateKey(plan.date, { month: "short" })}
        </span>
        <span className="text-foreground text-xl font-bold leading-none">
          {formatDateKey(plan.date, { day: "numeric" })}
        </span>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <Link
            to="/plans/:planId"
            params={{ planId: plan.id }}
            className="text-foreground font-semibold hover:underline"
          >
            {formatDateKey(plan.date, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </Link>
          <span className="text-muted-foreground text-xs tabular-nums">
            {percent}% done · {summary.doneSteps}/{summary.totalSteps} steps ·{" "}
            {formatDuration(summary.plannedMinutes)} planned
          </span>
        </div>
        <Progress
          value={percent}
          className="h-1.5"
          aria-label={`${percent}% of steps done`}
        />
        {plan.taskNames.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Tasks">
            {plan.taskNames.slice(0, MAX_TASK_CHIPS).map((taskName) => (
              <li key={taskName}>
                <TaskChip>{taskName}</TaskChip>
              </li>
            ))}
            {extraTaskCount > 0 && (
              <li>
                <TaskChip muted>+{extraTaskCount} more</TaskChip>
              </li>
            )}
          </ul>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        asChild
        className="hidden shrink-0 sm:inline-flex"
      >
        <Link
          to="/plans/:planId"
          params={{ planId: plan.id }}
          aria-label={`Open plan for ${formatDateKey(plan.date)}`}
        >
          <ChevronRight />
        </Link>
      </Button>
    </li>
  );
}

function TaskChip({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-block max-w-[16rem] truncate rounded-full border px-2.5 py-0.5 text-xs",
        muted
          ? "text-muted-foreground border-dashed"
          : "bg-primary/10 text-foreground border-transparent",
      )}
    >
      {children}
    </span>
  );
}

//#region Comparison

function PlanComparison({
  idA,
  idB,
  onClear,
}: {
  idA: string;
  idB: string;
  onClear: () => void;
}) {
  const queryA = useQuery(getPlanById, { id: idA });
  const queryB = useQuery(getPlanById, { id: idB });

  let content: ReactNode;
  if (queryA.isLoading || queryB.isLoading) {
    content = <LoadingState label="Loading plans…" className="py-8" />;
  } else if (queryA.error || queryB.error || !queryA.data || !queryB.data) {
    content = (
      <ErrorState
        error={queryA.error ?? queryB.error}
        title="Couldn't load the plans to compare"
      />
    );
  } else {
    // Show the earlier day first.
    const [first, second] =
      compareDateKeys(queryA.data.date, queryB.data.date) <= 0
        ? [queryA.data, queryB.data]
        : [queryB.data, queryA.data];
    content = <ComparisonContent first={first} second={second} />;
  }

  return (
    <Card className="hover:shadow">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Comparison</CardTitle>
          <CardDescription>Two plans side by side.</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClear}
          aria-label="Clear comparison"
        >
          <X />
        </Button>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

function ComparisonContent({
  first,
  second,
}: {
  first: PlanWithSteps;
  second: PlanWithSteps;
}) {
  const summaryA = summarizeSteps(first.steps);
  const summaryB = summarizeSteps(second.steps);
  const tasksA = new Set(first.steps.map((step) => step.taskName));
  const tasksB = new Set(second.steps.map((step) => step.taskName));
  const onlyA = [...tasksA].filter((task) => !tasksB.has(task));
  const onlyB = [...tasksB].filter((task) => !tasksA.has(task));
  const inBoth = [...tasksA].filter((task) => tasksB.has(task));

  const labelA = formatDateKey(first.date);
  const labelB = formatDateKey(second.date);

  const rows: {
    label: string;
    format: (summary: PlanSummary) => string;
    value: (summary: PlanSummary) => number;
  }[] = [
    {
      label: "Completion",
      format: (summary) => `${Math.round(summary.completionRate * 100)}%`,
      value: (summary) => summary.completionRate,
    },
    {
      label: "Steps done",
      format: (summary) => `${summary.doneSteps} / ${summary.totalSteps}`,
      value: (summary) => summary.doneSteps,
    },
    {
      label: "Planned time",
      format: (summary) => formatDuration(summary.plannedMinutes),
      value: (summary) => summary.plannedMinutes,
    },
    {
      label: "Tracked time",
      format: (summary) => formatDuration(summary.trackedMinutes),
      value: (summary) => summary.trackedMinutes,
    },
    {
      label: "Tracked vs planned",
      format: (summary) =>
        summary.plannedMinutes === 0
          ? "–"
          : `${Math.round(
              (summary.trackedMinutes / summary.plannedMinutes) * 100,
            )}%`,
      value: (summary) =>
        summary.plannedMinutes === 0
          ? 0
          : summary.trackedMinutes / summary.plannedMinutes,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th scope="col" className="py-2 pr-4 text-left">
                <span className="sr-only">Metric</span>
              </th>
              <PlanColumnHeader plan={first} label={labelA} />
              <PlanColumnHeader plan={second} label={labelB} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const a = row.value(summaryA);
              const b = row.value(summaryB);
              return (
                <tr key={row.label} className="border-b last:border-0">
                  <th
                    scope="row"
                    className="text-muted-foreground py-2 pr-4 text-left font-normal"
                  >
                    {row.label}
                  </th>
                  <td
                    className={cn(
                      "py-2 text-right tabular-nums",
                      a > b && "text-foreground font-semibold",
                    )}
                  >
                    {row.format(summaryA)}
                  </td>
                  <td
                    className={cn(
                      "py-2 pl-4 text-right tabular-nums",
                      b > a && "text-foreground font-semibold",
                    )}
                  >
                    {row.format(summaryB)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <TaskGroup title={`Only on ${labelA}`} tasks={onlyA} />
        <TaskGroup title="On both days" tasks={inBoth} />
        <TaskGroup title={`Only on ${labelB}`} tasks={onlyB} />
      </div>
    </div>
  );
}

function PlanColumnHeader({
  plan,
  label,
}: {
  plan: PlanWithSteps;
  label: string;
}) {
  return (
    <th scope="col" className="py-2 pl-4 text-right font-semibold">
      <Link
        to="/plans/:planId"
        params={{ planId: plan.id }}
        className="text-foreground hover:underline"
      >
        {label}
      </Link>
    </th>
  );
}

function TaskGroup({ title, tasks }: { title: string; tasks: string[] }) {
  return (
    <div className="bg-muted/40 rounded-lg border p-3">
      <h4 className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
        {title} <span className="tabular-nums">({tasks.length})</span>
      </h4>
      {tasks.length === 0 ? (
        <p className="text-muted-foreground text-xs">None</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {tasks.map((task) => (
            <li key={task}>
              <TaskChip>{task}</TaskChip>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

//#endregion
