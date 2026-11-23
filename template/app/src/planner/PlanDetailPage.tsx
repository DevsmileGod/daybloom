import {
  ArrowLeft,
  CalendarSearch,
  Copy,
  Download,
  Loader2,
  Save,
  Trash2,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import {
  deletePlan,
  duplicatePlanToDate,
  getPlanById,
  updatePlanNote,
  useQuery,
} from "wasp/client/operations";
import { Link, routes } from "wasp/client/router";
import type { Plan } from "wasp/entities";
import { PageContainer, PageHeader } from "../client/components/PageHeader";
import { Button } from "../client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../client/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../client/components/ui/dialog";
import { Input } from "../client/components/ui/input";
import { Label } from "../client/components/ui/label";
import { Textarea } from "../client/components/ui/textarea";
import { getStatusCode } from "../client/errors";
import { toast } from "../client/hooks/use-toast";
import { downloadPlanIcs } from "./components/downloadIcs";
import { EmptyState, ErrorState, LoadingState } from "./components/PageStates";
import { PlanSummaryBar } from "./components/PlanSummaryBar";
import { StepList } from "./components/StepList";
import { showErrorToast } from "./components/toasts";
import { usePlannerTimeZone } from "./hooks/usePlannerTimeZone";
import { addDaysToDateKey, formatDateKey, isValidDateKey } from "./lib/dates";

const NOTE_MAX_LENGTH = 2000;

export function PlanDetailPage() {
  const { planId } = useParams();
  const { timeZone, today } = usePlannerTimeZone();
  const planQuery = useQuery(
    getPlanById,
    { id: planId ?? "" },
    { enabled: !!planId },
  );
  const plan = planQuery.data;

  const backLink = (
    <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
      <Link to={routes.PlanHistoryRoute.to}>
        <ArrowLeft /> All plans
      </Link>
    </Button>
  );

  if (!planId || getStatusCode(planQuery.error) === 404) {
    return (
      <PageContainer>
        {backLink}
        <EmptyState
          icon={<CalendarSearch />}
          title="Plan not found"
          description="This plan doesn't exist or was deleted."
          action={
            <Button asChild>
              <Link to={routes.PlanHistoryRoute.to}>Browse your plans</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  if (planQuery.isLoading) {
    return (
      <PageContainer>
        {backLink}
        <LoadingState label="Loading plan…" />
      </PageContainer>
    );
  }

  if (planQuery.error || !plan) {
    return (
      <PageContainer>
        {backLink}
        <ErrorState
          error={planQuery.error}
          title="Couldn't load the plan"
          action={
            <Button variant="outline" onClick={() => planQuery.refetch()}>
              Try again
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const isToday = plan.date === today;

  return (
    <PageContainer>
      {backLink}
      <PageHeader
        title={formatDateKey(plan.date, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        description={`${isToday ? "Today · " : ""}${formatDateKey(plan.date, {
          year: "numeric",
        })} · ${plan.hours}h workday · created ${plan.createdAt.toLocaleDateString()}`}
        actions={
          <>
            <CopyPlanDialog
              planId={plan.id}
              defaultDate={addDaysToDateKey(
                plan.date < today ? today : plan.date,
                1,
              )}
            />
            <Button
              variant="outline"
              onClick={() => downloadPlanIcs(plan, timeZone)}
              disabled={plan.steps.length === 0}
            >
              <Download /> Download .ics
            </Button>
            <DeletePlanDialog plan={plan} />
          </>
        }
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <Card className="hover:shadow">
          <CardHeader>
            <CardTitle>Steps</CardTitle>
            <CardDescription>
              Check off steps and track time. Edit the order and details on the{" "}
              <Link
                to={routes.PlannerRoute.to}
                className="text-primary underline-offset-4 hover:underline"
              >
                planner
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <PlanSummaryBar steps={plan.steps} />
            {plan.steps.length > 0 ? (
              <StepList steps={plan.steps} />
            ) : (
              <p className="text-muted-foreground py-6 text-center text-sm">
                This plan has no steps.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>
              How did the day go? Notes are searchable in your history.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NoteEditor key={plan.id} plan={plan} />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

function NoteEditor({ plan }: { plan: Pick<Plan, "id" | "note"> }) {
  const savedNote = plan.note ?? "";
  const [value, setValue] = useState(savedNote);
  const [isSaving, setIsSaving] = useState(false);
  const isDirty = value !== savedNote;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const updated = await updatePlanNote({ id: plan.id, note: value });
      setValue(updated.note ?? "");
      toast({ title: "Note saved" });
    } catch (error) {
      showErrorToast(error, "Couldn't save note");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Label htmlFor="plan-note" className="sr-only">
        Note
      </Label>
      <Textarea
        id="plan-note"
        value={value}
        maxLength={NOTE_MAX_LENGTH}
        rows={8}
        placeholder="Wins, blockers, what to change tomorrow…"
        onChange={(event) => setValue(event.currentTarget.value)}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs tabular-nums">
          {value.length}/{NOTE_MAX_LENGTH}
        </span>
        <Button type="submit" disabled={!isDirty || isSaving}>
          {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
          Save note
        </Button>
      </div>
    </form>
  );
}

function CopyPlanDialog({
  planId,
  defaultDate,
}: {
  planId: string;
  defaultDate: string;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [isCopying, setIsCopying] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setDate(defaultDate);
    setOpen(nextOpen);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValidDateKey(date)) return;
    setIsCopying(true);
    try {
      const copy = await duplicatePlanToDate({ planId, date });
      toast({
        title: "Plan copied",
        description: `Copied to ${formatDateKey(date)}.`,
      });
      setOpen(false);
      navigate(routes.PlanDetailRoute.build({ params: { planId: copy.id } }));
    } catch (error) {
      showErrorToast(error, "Couldn't copy plan");
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => handleOpenChange(true)}>
        <Copy /> Copy to another day
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-lg sm:max-w-md">
          <form onSubmit={handleSubmit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Copy plan to another day</DialogTitle>
              <DialogDescription>
                All steps are copied with progress and tracked time reset.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="copy-plan-date">Date</Label>
              <Input
                id="copy-plan-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.currentTarget.value)}
                required
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isValidDateKey(date) || isCopying}
              >
                {isCopying ? <Loader2 className="animate-spin" /> : <Copy />}
                Copy plan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeletePlanDialog({ plan }: { plan: Pick<Plan, "id" | "date"> }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deletePlan({ id: plan.id });
      toast({ title: "Plan deleted" });
      setOpen(false);
      navigate(routes.PlanHistoryRoute.to);
    } catch (error) {
      showErrorToast(error, "Couldn't delete plan");
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 /> Delete plan
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-lg sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this plan?</DialogTitle>
            <DialogDescription>
              The plan for {formatDateKey(plan.date)} and all its steps and
              tracked time will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Delete plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
