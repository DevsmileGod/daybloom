import {
  CalendarPlus,
  ChevronRight,
  ListTodo,
  Loader2,
  Plus,
  Share2,
  UserCheck,
  Users,
} from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import {
  createWorkspace,
  getMyWorkspaces,
  useQuery,
} from "wasp/client/operations";
import { Link, routes } from "wasp/client/router";
import { PageContainer, PageHeader } from "../client/components/PageHeader";
import { Button } from "../client/components/ui/button";
import {
  Card,
  CardContent,
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
import { getErrorMessage } from "../client/errors";
import { RoleBadge } from "./components/RoleBadge";
import type { WorkspaceSummary } from "./operations";

export function WorkspacesPage() {
  const { data: workspaces, isLoading, error, refetch } =
    useQuery(getMyWorkspaces);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const hasWorkspaces = !!workspaces && workspaces.length > 0;

  return (
    <PageContainer>
      <PageHeader
        title="Teams"
        description="Share tasks with the people you work with, assign them, and pull them into your own AI plan."
        actions={
          hasWorkspaces && (
            <Button type="button" onClick={() => setIsCreateOpen(true)}>
              <Plus aria-hidden="true" />
              New team
            </Button>
          )
        }
      />

      <div className="mt-8">
        {isLoading ? (
          <div
            className="text-muted-foreground flex items-center justify-center gap-2 py-24"
            role="status"
          >
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Loading your teams…
          </div>
        ) : error ? (
          <Card className="mx-auto max-w-lg hover:shadow">
            <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
              <p className="text-foreground font-medium">
                Couldn't load your teams
              </p>
              <p className="text-muted-foreground text-sm">
                {getErrorMessage(error)}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => refetch()}
              >
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : workspaces && workspaces.length > 0 ? (
          <ul
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-label="Your teams"
          >
            {workspaces.map((workspace) => (
              <li key={workspace.id}>
                <WorkspaceCard workspace={workspace} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState onCreate={() => setIsCreateOpen(true)} />
        )}
      </div>

      <CreateWorkspaceDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </PageContainer>
  );
}

function WorkspaceCard({ workspace }: { workspace: WorkspaceSummary }) {
  return (
    <Link
      to={routes.WorkspaceRoute.to}
      params={{ workspaceId: workspace.id }}
      className="focus-visible:ring-ring group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2"
    >
      <Card className="flex h-full flex-col">
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <CardTitle className="text-foreground min-w-0 break-words text-lg">
            {workspace.name}
          </CardTitle>
          <RoleBadge role={workspace.role} className="shrink-0" />
        </CardHeader>
        <CardContent className="mt-auto flex items-center justify-between gap-3">
          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" aria-hidden="true" />
              {workspace.memberCount}{" "}
              {workspace.memberCount === 1 ? "member" : "members"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ListTodo className="h-4 w-4" aria-hidden="true" />
              {workspace.openTaskCount} open{" "}
              {workspace.openTaskCount === 1 ? "task" : "tasks"}
            </span>
          </div>
          <ChevronRight
            className="text-muted-foreground group-hover:text-foreground h-5 w-5 shrink-0 transition-colors"
            aria-hidden="true"
          />
        </CardContent>
      </Card>
    </Link>
  );
}

const TEAM_BENEFITS = [
  {
    icon: Share2,
    title: "Share tasks",
    text: "Keep one list of everything the team needs to get done.",
  },
  {
    icon: UserCheck,
    title: "Assign them",
    text: "Give each task an owner and a due date so nothing slips.",
  },
  {
    icon: CalendarPlus,
    title: "Plan your day",
    text: "Add any shared task to your own list and let AI schedule it.",
  },
];

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="mx-auto max-w-3xl hover:shadow">
      <CardContent className="flex flex-col items-center gap-6 px-6 py-12 text-center">
        <div className="bg-primary/10 text-primary flex h-14 w-14 items-center justify-center rounded-full">
          <Users className="h-7 w-7" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h2 className="text-foreground text-xl font-semibold">
            You're not in any team yet
          </h2>
          <p className="text-muted-foreground mx-auto max-w-md text-sm">
            Create a team for your household, project or company and invite
            people by email. Got an invite? Open the link in the email to join.
          </p>
        </div>
        <ul className="grid w-full gap-4 text-left sm:grid-cols-3">
          {TEAM_BENEFITS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="bg-muted/40 rounded-lg border p-4">
              <Icon className="text-primary mb-2 h-5 w-5" aria-hidden="true" />
              <p className="text-foreground text-sm font-medium">{title}</p>
              <p className="text-muted-foreground mt-1 text-sm">{text}</p>
            </li>
          ))}
        </ul>
        <Button type="button" onClick={onCreate}>
          <Plus aria-hidden="true" />
          Create your first team
        </Button>
      </CardContent>
    </Card>
  );
}

function CreateWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && <CreateWorkspaceForm onCancel={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function CreateWorkspaceForm({ onCancel }: { onCancel: () => void }) {
  const inputId = useId();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmedName || isPending) return;
    setIsPending(true);
    setError(null);
    try {
      const workspace = await createWorkspace({ name: trimmedName });
      navigate(
        routes.WorkspaceRoute.build({ params: { workspaceId: workspace.id } }),
      );
    } catch (err) {
      setError(getErrorMessage(err));
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>New team</DialogTitle>
        <DialogDescription>
          You'll be the owner and can invite people right after.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor={inputId}>Team name</Label>
        <Input
          id={inputId}
          placeholder="e.g. Marketing, Home, Side project"
          value={name}
          maxLength={80}
          autoFocus
          onChange={(event) => setName(event.currentTarget.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <DialogFooter className="gap-2 sm:gap-0">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!trimmedName || isPending}>
          {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Create team
        </Button>
      </DialogFooter>
    </form>
  );
}
