import {
  Bell,
  BellRing,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import {
  generatePlan,
  getAllTasksByUser,
  getPlanForDate,
  useQuery,
} from "wasp/client/operations";
import { Link } from "wasp/client/router";
import { PageContainer, PageHeader } from "../client/components/PageHeader";
import { Button } from "../client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../client/components/ui/card";
import { Input } from "../client/components/ui/input";
import { Label } from "../client/components/ui/label";
import { toast } from "../client/hooks/use-toast";
import { AddStepForm } from "./components/AddStepForm";
import { downloadPlanIcs } from "./components/downloadIcs";
import { EmptyState, ErrorState, LoadingState } from "./components/PageStates";
import { PlanSummaryBar } from "./components/PlanSummaryBar";
import { StepList } from "./components/StepList";
import { TaskListEditor } from "./components/TaskListEditor";
import { showPaidActionErrorToast } from "./components/toasts";
import { usePlannerTimeZone } from "./hooks/usePlannerTimeZone";
import { useStepNotifications } from "./hooks/useStepNotifications";
import { addDaysToDateKey, formatDateKey, isValidDateKey } from "./lib/dates";
import { formatMinutesAsClock, parseClock } from "./lib/time";

const DEFAULT_WORKDAY_START = 9 * 60;
const MIN_HOURS = 0.5;
const MAX_HOURS = 24;

export function PlannerPage() {
  const {
    settings,
    timeZone,
    today,
    isLoading: isSettingsLoading,
  } = usePlannerTimeZone();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const date = selectedDate ?? today;
  const isToday = date === today;

  const planQuery = useQuery(
    getPlanForDate,
    { date },
    { enabled: !isSettingsLoading },
  );
  const plan = planQuery.data;
  const { data: tasks } = useQuery(getAllTasksByUser);
  const openTaskCount = tasks?.filter((task) => !task.isDone).length ?? 0;

  const { permission, requestPermission } = useStepNotifications(
    plan,
    timeZone,
  );

  // Generation inputs. `null` start time means "use the settings default".
  const [hours, setHours] = useState("8");
  const [startTime, setStartTime] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const effectiveStartTime =
    startTime ??
    formatMinutesAsClock(
      settings?.workdayStartMinutes ?? DEFAULT_WORKDAY_START,
    );
  const parsedHours = Number.parseFloat(hours);
  const isHoursValid =
    Number.isFinite(parsedHours) &&
    parsedHours >= MIN_HOURS &&
    parsedHours <= MAX_HOURS;
  const parsedStart =
    effectiveStartTime === "" ? undefined : parseClock(effectiveStartTime);
  const canGenerate =
    isHoursValid && parsedStart !== null && openTaskCount > 0 && !isGenerating;

  /** @param replacePlanId when regenerating, the plan the new one replaces */
  const handleGenerate = async (replacePlanId?: string) => {
    if (!canGenerate || parsedStart === null) return;
    setIsGenerating(true);
    try {
      await generatePlan({
        date,
        hours: parsedHours,
        startMinute: parsedStart,
        replacePlanId,
      });
      toast({
        title: "Your plan is ready",
        description: `Planned ${formatDateKey(date)}.`,
      });
    } catch (error) {
      showPaidActionErrorToast(error, "Couldn't generate plan");
    } finally {
      setIsGenerating(false);
    }
  };

  const goToDate = (next: string) =>
    setSelectedDate(next === today ? null : next);

  return (
    <PageContainer>
      <PageHeader
        title={isToday ? "Today" : formatDateKey(date, { weekday: "long" })}
        description={formatDateKey(date, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
        actions={
          <div
            className="flex items-center gap-1"
            role="group"
            aria-label="Choose day"
          >
            <Button
              variant="outline"
              size="icon"
              onClick={() => goToDate(addDaysToDateKey(date, -1))}
              aria-label="Previous day"
            >
              <ChevronLeft />
            </Button>
            <Label htmlFor="planner-date" className="sr-only">
              Date
            </Label>
            <Input
              id="planner-date"
              type="date"
              value={date}
              onChange={(event) => {
                const value = event.currentTarget.value;
                if (isValidDateKey(value)) goToDate(value);
              }}
              className="w-[9.5rem]"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => goToDate(addDaysToDateKey(date, 1))}
              aria-label="Next day"
            >
              <ChevronRight />
            </Button>
            <Button
              variant="secondary"
              onClick={() => setSelectedDate(null)}
              disabled={isToday}
            >
              Today
            </Button>
          </div>
        }
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        <Card className="hover:shadow">
          <CardHeader>
            <CardTitle>Your tasks</CardTitle>
            <CardDescription>
              Open tasks are what the AI plans your day from.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <TaskListEditor />
            <div className="space-y-4 border-t pt-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="plan-hours">
                    How many hours will you work?
                  </Label>
                  <Input
                    id="plan-hours"
                    type="number"
                    inputMode="decimal"
                    min={MIN_HOURS}
                    max={MAX_HOURS}
                    step={0.5}
                    value={hours}
                    onChange={(event) => setHours(event.currentTarget.value)}
                    aria-invalid={!isHoursValid}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plan-start">Start time</Label>
                  <Input
                    id="plan-start"
                    type="time"
                    step={300}
                    value={effectiveStartTime}
                    onChange={(event) =>
                      setStartTime(event.currentTarget.value)
                    }
                    aria-invalid={parsedStart === null}
                  />
                </div>
              </div>
              {!isHoursValid && (
                <p className="text-destructive text-xs">
                  Enter between {MIN_HOURS} and {MAX_HOURS} hours.
                </p>
              )}
              <Button
                className="w-full"
                onClick={() => handleGenerate()}
                disabled={!canGenerate}
              >
                {isGenerating ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Sparkles />
                )}
                {isGenerating
                  ? "Planning your day…"
                  : `Generate plan for ${isToday ? "today" : formatDateKey(date)}`}
              </Button>
              {openTaskCount === 0 && tasks && (
                <p className="text-muted-foreground text-center text-xs">
                  Add at least one open task to generate a plan.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow">
          <CardHeader className="gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle>Plan</CardTitle>
              <CardDescription>
                {plan
                  ? `${plan.steps.length} steps · ${plan.hours}h workday`
                  : formatDateKey(date)}
              </CardDescription>
            </div>
            {plan && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerate(plan.id)}
                  disabled={!canGenerate}
                  title="Replace this plan with a fresh one, using the settings on the left"
                >
                  <RefreshCw className={isGenerating ? "animate-spin" : ""} />
                  Regenerate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadPlanIcs(plan, timeZone)}
                  disabled={plan.steps.length === 0}
                >
                  <Download /> .ics
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/plans/:planId" params={{ planId: plan.id }}>
                    <ExternalLink /> Details
                  </Link>
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            {isToday && plan && permission === "default" && (
              <div className="bg-primary/5 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm">
                <span className="text-muted-foreground">
                  Get a browser notification when each step starts.
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={requestPermission}
                >
                  <Bell /> Enable browser reminders
                </Button>
              </div>
            )}
            {isToday && plan && permission === "granted" && (
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <BellRing className="text-primary size-3.5" />
                Browser reminders are on while this tab is open.
              </p>
            )}

            {planQuery.isLoading || isSettingsLoading ? (
              <LoadingState label="Loading plan…" />
            ) : planQuery.error ? (
              <ErrorState
                error={planQuery.error}
                title="Couldn't load the plan"
                action={
                  <Button variant="outline" onClick={() => planQuery.refetch()}>
                    Try again
                  </Button>
                }
              />
            ) : !plan ? (
              <EmptyState
                icon={<CalendarPlus />}
                title={`No plan for ${isToday ? "today" : formatDateKey(date)} yet`}
                description={
                  openTaskCount > 0
                    ? "Set your hours and generate a plan from your open tasks."
                    : "Add a few tasks first, then generate a plan."
                }
                action={
                  openTaskCount > 0 ? (
                    <Button
                      onClick={() => handleGenerate()}
                      disabled={!canGenerate}
                    >
                      {isGenerating ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Sparkles />
                      )}
                      Generate plan
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <PlanSummaryBar steps={plan.steps} />
                {plan.note && (
                  <p className="text-muted-foreground border-l-primary/50 border-l-2 pl-3 text-sm italic">
                    {plan.note}
                  </p>
                )}
                {plan.steps.length > 0 ? (
                  <StepList steps={plan.steps} editable />
                ) : (
                  <p className="text-muted-foreground py-4 text-center text-sm">
                    This plan has no steps. Add one below.
                  </p>
                )}
                <AddStepForm planId={plan.id} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
