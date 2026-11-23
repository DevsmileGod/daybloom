import { Bell, Check, Copy, Globe, Loader2, Mail, Rss } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import {
  disableCalendarFeed,
  getCalendarFeed,
  getPlannerSettings,
  rotateCalendarFeedToken,
  updatePlannerSettings,
  useQuery,
} from "wasp/client/operations";
import { PageContainer, PageHeader } from "../client/components/PageHeader";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../client/components/ui/alert";
import { Button } from "../client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../client/components/ui/card";
import { Input } from "../client/components/ui/input";
import { Label } from "../client/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../client/components/ui/select";
import { Separator } from "../client/components/ui/separator";
import { Switch } from "../client/components/ui/switch";
import { getErrorMessage } from "../client/errors";
import { toast } from "../client/hooks/use-toast";
import { getRuntimeTimeZone, isValidTimeZone } from "../planner/lib/dates";
import { formatMinutesAsClock, parseClock } from "../planner/lib/time";
import { ConfirmDialog } from "../recurring/components/ConfirmDialog";

const LEAD_TIME_OPTIONS = [0, 5, 10, 15, 30, 60];

/** Matches the server-side `PlannerSettings` returned by getPlannerSettings. */
interface PlannerSettingsData {
  timeZone: string;
  workdayStartMinutes: number;
  emailRemindersEnabled: boolean;
  reminderLeadMinutes: number;
  hasEmail: boolean;
}

export function PlannerSettingsPage() {
  const {
    data: settings,
    isLoading,
    error,
    refetch,
  } = useQuery(getPlannerSettings);

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Choose how Daybloom plans your days, reminds you, and shares your schedule with other calendars."
      />

      <div className="mt-8 grid max-w-3xl gap-6">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Couldn't load your settings</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span>{getErrorMessage(error)}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void refetch()}
              >
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : isLoading || !settings ? (
          <LoadingCard label="Loading your settings…" />
        ) : (
          <>
            <PlannerSettingsCard
              key={`${settings.timeZone}|${settings.workdayStartMinutes}`}
              settings={settings}
            />
            <RemindersCard
              key={`${settings.emailRemindersEnabled}|${settings.reminderLeadMinutes}`}
              settings={settings}
            />
          </>
        )}
        <CalendarFeedCard />
      </div>
    </PageContainer>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <Card>
      <CardContent
        className="text-muted-foreground flex items-center gap-2 p-6 text-sm"
        role="status"
      >
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        {label}
      </CardContent>
    </Card>
  );
}

//#region Planner

function getSupportedTimeZones(): string[] {
  if (typeof Intl.supportedValuesOf !== "function") return [];
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [];
  }
}

function PlannerSettingsCard({ settings }: { settings: PlannerSettingsData }) {
  const [timeZone, setTimeZone] = useState(settings.timeZone);
  const [workdayStart, setWorkdayStart] = useState(
    formatMinutesAsClock(settings.workdayStartMinutes),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const timeZones = useMemo(getSupportedTimeZones, []);
  const runtimeTimeZone = useMemo(getRuntimeTimeZone, []);

  const trimmedTimeZone = timeZone.trim();
  const workdayStartMinutes = parseClock(workdayStart);
  const isDirty =
    trimmedTimeZone !== settings.timeZone ||
    workdayStartMinutes !== settings.workdayStartMinutes;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValidTimeZone(trimmedTimeZone)) {
      setError(
        `"${trimmedTimeZone}" isn't a time zone we know. Use a name like Europe/Berlin or America/New_York.`,
      );
      return;
    }
    if (workdayStartMinutes === null) {
      setError("Enter the workday start as HH:MM, e.g. 09:00.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await updatePlannerSettings({
        timeZone: trimmedTimeZone,
        workdayStartMinutes,
      });
      toast({ title: "Planner settings saved" });
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit} noValidate>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="size-5" aria-hidden="true" /> Planner
          </CardTitle>
          <CardDescription>
            Your time zone decides what "today" means and when reminders go out.
            New plans start at your workday start time.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="settings-time-zone">Time zone</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="settings-time-zone"
                value={timeZone}
                onChange={(event) => setTimeZone(event.target.value)}
                list={timeZones.length > 0 ? "settings-time-zones" : undefined}
                placeholder="e.g. Europe/Berlin"
                autoComplete="off"
                spellCheck={false}
                aria-describedby="settings-time-zone-help"
                aria-invalid={
                  trimmedTimeZone !== "" && !isValidTimeZone(trimmedTimeZone)
                }
              />
              {timeZones.length > 0 && (
                <datalist id="settings-time-zones">
                  {timeZones.map((zone) => (
                    <option key={zone} value={zone} />
                  ))}
                </datalist>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => setTimeZone(runtimeTimeZone)}
                disabled={trimmedTimeZone === runtimeTimeZone}
              >
                Use my current time zone
              </Button>
            </div>
            <p
              id="settings-time-zone-help"
              className="text-muted-foreground text-xs"
            >
              This device is set to {runtimeTimeZone}.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="settings-workday-start">Workday starts at</Label>
            <Input
              id="settings-workday-start"
              type="time"
              step={900}
              value={workdayStart}
              onChange={(event) => setWorkdayStart(event.target.value)}
              className="w-36"
            />
          </div>

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={!isDirty || isSaving}>
            {isSaving && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

//#endregion

//#region Reminders

type BrowserPermission = NotificationPermission | "unsupported";

function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

function readNotificationPermission(): BrowserPermission {
  return isNotificationSupported() ? Notification.permission : "unsupported";
}

function formatLeadTime(minutes: number): string {
  if (minutes === 0) return "When the step starts";
  if (minutes === 60) return "1 hour before";
  if (minutes % 60 === 0) return `${minutes / 60} hours before`;
  return `${minutes} minutes before`;
}

function RemindersCard({ settings }: { settings: PlannerSettingsData }) {
  const [emailEnabled, setEmailEnabled] = useState(
    settings.emailRemindersEnabled,
  );
  const [leadMinutes, setLeadMinutes] = useState(settings.reminderLeadMinutes);
  const [isSaving, setIsSaving] = useState(false);
  const [permission, setPermission] = useState<BrowserPermission>(
    readNotificationPermission,
  );

  const leadOptions = LEAD_TIME_OPTIONS.includes(leadMinutes)
    ? LEAD_TIME_OPTIONS
    : [...LEAD_TIME_OPTIONS, leadMinutes].sort((a, b) => a - b);

  const save = async (
    changes: { emailRemindersEnabled?: boolean; reminderLeadMinutes?: number },
    revert: () => void,
  ) => {
    setIsSaving(true);
    try {
      await updatePlannerSettings(changes);
      toast({ title: "Reminder settings saved" });
    } catch (error) {
      revert();
      toast({
        title: "Couldn't save reminder settings",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEmailToggle = (checked: boolean) => {
    const previous = emailEnabled;
    setEmailEnabled(checked);
    void save({ emailRemindersEnabled: checked }, () =>
      setEmailEnabled(previous),
    );
  };

  const handleLeadChange = (value: string) => {
    const minutes = Number(value);
    if (!Number.isInteger(minutes)) return;
    const previous = leadMinutes;
    setLeadMinutes(minutes);
    void save({ reminderLeadMinutes: minutes }, () => setLeadMinutes(previous));
  };

  const requestPermission = async () => {
    if (!isNotificationSupported()) return;
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      setPermission(readNotificationPermission());
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="size-5" aria-hidden="true" /> Reminders
        </CardTitle>
        <CardDescription>
          Get a heads-up before the steps of today's plan begin.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <Label
              htmlFor="settings-email-reminders"
              className="flex items-center gap-2"
            >
              <Mail className="size-4" aria-hidden="true" /> Email reminders
            </Label>
            <p
              id="settings-email-reminders-help"
              className="text-muted-foreground text-sm"
            >
              {settings.hasEmail
                ? "We'll email you before each unfinished step of today's plan starts."
                : "Your account has no email address, so we can't send email reminders. Sign in with an email account to use them."}
            </p>
          </div>
          <Switch
            id="settings-email-reminders"
            checked={emailEnabled}
            onCheckedChange={handleEmailToggle}
            disabled={!settings.hasEmail || isSaving}
            aria-describedby="settings-email-reminders-help"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="settings-lead-time">Remind me</Label>
          <Select
            value={String(leadMinutes)}
            onValueChange={handleLeadChange}
            disabled={isSaving}
          >
            <SelectTrigger id="settings-lead-time" className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {leadOptions.map((minutes) => (
                <SelectItem key={minutes} value={String(minutes)}>
                  {formatLeadTime(minutes)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-1">
            <p className="text-sm font-medium">Browser notifications</p>
            <p className="text-muted-foreground text-sm">
              Show a notification on this device when a step starts, while the
              planner is open in a tab.
            </p>
            <p className="text-sm" aria-live="polite">
              <BrowserPermissionStatus permission={permission} />
            </p>
          </div>
          {(permission === "default" || permission === "denied") && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void requestPermission()}
              disabled={permission === "denied"}
            >
              Allow notifications
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BrowserPermissionStatus({
  permission,
}: {
  permission: BrowserPermission;
}) {
  switch (permission) {
    case "granted":
      return (
        <span className="text-success inline-flex items-center gap-1">
          <Check className="size-4" aria-hidden="true" /> Allowed on this device
        </span>
      );
    case "denied":
      return (
        <span className="text-destructive">
          Blocked. Allow notifications for this site in your browser settings to
          turn them on.
        </span>
      );
    case "default":
      return <span className="text-muted-foreground">Not allowed yet.</span>;
    case "unsupported":
      return (
        <span className="text-muted-foreground">
          This browser doesn't support notifications.
        </span>
      );
  }
}

//#endregion

//#region Calendar feed

async function copyText(
  text: string,
  fallbackInput: HTMLInputElement | null,
): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the selection-based fallback (e.g. non-HTTPS pages).
    }
  }
  if (!fallbackInput) return false;
  fallbackInput.focus();
  fallbackInput.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  }
}

function CalendarFeedCard() {
  const { data: feed, isLoading, error, refetch } = useQuery(getCalendarFeed);
  const [isTogglingOn, setIsTogglingOn] = useState(false);
  const [confirm, setConfirm] = useState<"reset" | "disable" | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const turnOn = async () => {
    setIsTogglingOn(true);
    try {
      await rotateCalendarFeedToken();
      toast({ title: "Calendar feed turned on" });
    } catch (turnOnError) {
      toast({
        title: "Couldn't turn on the calendar feed",
        description: getErrorMessage(turnOnError),
        variant: "destructive",
      });
    } finally {
      setIsTogglingOn(false);
    }
  };

  const handleCopy = async (url: string) => {
    const copied = await copyText(url, urlInputRef.current);
    if (copied) {
      setHasCopied(true);
      window.setTimeout(() => setHasCopied(false), 2000);
      toast({ title: "Link copied" });
    } else {
      toast({
        title: "Couldn't copy automatically",
        description: "Select the link and copy it manually.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rss className="size-5" aria-hidden="true" /> Calendar subscription
        </CardTitle>
        <CardDescription>
          Subscribe to your plans from Google Calendar, Apple Calendar or
          Outlook. Your calendar app checks for changes on its own schedule,
          usually every few hours.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Couldn't load your calendar feed</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span>{getErrorMessage(error)}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void refetch()}
              >
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : isLoading || !feed ? (
          <p
            className="text-muted-foreground flex items-center gap-2 text-sm"
            role="status"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading…
          </p>
        ) : feed.url === null ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-muted-foreground text-sm">
              The feed is off. Turning it on creates a private link that anyone
              who has it can use to see your plans, so keep it to yourself.
            </p>
            <Button
              type="button"
              onClick={() => void turnOn()}
              disabled={isTogglingOn}
            >
              {isTogglingOn && <Loader2 className="animate-spin" />}
              Turn on calendar feed
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-2">
              <Label htmlFor="settings-feed-url">Your private feed link</Label>
              <div className="flex gap-2">
                <Input
                  id="settings-feed-url"
                  ref={urlInputRef}
                  value={feed.url}
                  readOnly
                  onFocus={(event) => event.currentTarget.select()}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => feed.url && void handleCopy(feed.url)}
                  aria-label="Copy feed link"
                >
                  {hasCopied ? <Check /> : <Copy />}
                  <span className="hidden sm:inline">
                    {hasCopied ? "Copied" : "Copy"}
                  </span>
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Keep this link private: anyone who has it can see your plans.
              </p>
            </div>

            <div className="grid gap-2 text-sm">
              <p className="font-medium">How to subscribe</p>
              <ul className="text-muted-foreground grid gap-1.5">
                <li>
                  <span className="text-foreground font-medium">
                    Google Calendar:
                  </span>{" "}
                  Other calendars → <em>+</em> → From URL, then paste the link.
                </li>
                <li>
                  <span className="text-foreground font-medium">
                    Apple Calendar:
                  </span>{" "}
                  File → New Calendar Subscription, then paste the link.
                </li>
                <li>
                  <span className="text-foreground font-medium">Outlook:</span>{" "}
                  Add calendar → Subscribe from web, then paste the link.
                </li>
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirm("reset")}
              >
                Reset link
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirm("disable")}
              >
                Turn off
              </Button>
            </div>
          </>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirm === "reset"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Reset the feed link?"
        description="You'll get a new link. Calendars subscribed to the old link stop updating, so you'll need to subscribe again with the new one."
        confirmLabel="Reset link"
        onConfirm={async () => {
          await rotateCalendarFeedToken();
          toast({ title: "New feed link created" });
        }}
      />
      <ConfirmDialog
        open={confirm === "disable"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Turn off the calendar feed?"
        description="The current link stops working and subscribed calendars stop updating. You can turn the feed on again later, but it will use a new link."
        confirmLabel="Turn off"
        destructive
        onConfirm={async () => {
          await disableCalendarFeed();
          toast({ title: "Calendar feed turned off" });
        }}
      />
    </Card>
  );
}

//#endregion
