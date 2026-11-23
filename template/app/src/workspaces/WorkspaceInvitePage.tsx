import {
  CheckCircle2,
  Clock,
  Link2Off,
  Loader2,
  LogOut,
  MailWarning,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import type { AuthUser } from "wasp/auth";
import { logout } from "wasp/client/auth";
import {
  acceptWorkspaceInvite,
  getWorkspaceInvite,
  useQuery,
} from "wasp/client/operations";
import { Link, routes } from "wasp/client/router";
import { PageContainer } from "../client/components/PageHeader";
import { Button } from "../client/components/ui/button";
import { Card, CardContent } from "../client/components/ui/card";
import { getErrorMessage, getStatusCode } from "../client/errors";
import { toast } from "../client/hooks/use-toast";
import { cn } from "../client/utils";

export function WorkspaceInvitePage({ user }: { user: AuthUser }) {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const {
    data: invite,
    isLoading,
    error,
    refetch,
  } = useQuery(getWorkspaceInvite, { token });
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const handleAccept = async () => {
    setIsAccepting(true);
    setAcceptError(null);
    try {
      const { workspaceId } = await acceptWorkspaceInvite({ token });
      toast({ title: `Welcome to ${invite?.workspaceName ?? "the team"}!` });
      navigate(routes.WorkspaceRoute.build({ params: { workspaceId } }));
    } catch (err) {
      setAcceptError(getErrorMessage(err));
      setIsAccepting(false);
      // The invite may have expired or been used meanwhile.
      void refetch();
    }
  };

  const teamsLink = (
    <Button asChild variant="outline">
      <Link to={routes.WorkspacesRoute.to}>Go to your teams</Link>
    </Button>
  );

  let content: ReactNode;

  if (isLoading) {
    content = (
      <div
        className="text-muted-foreground flex items-center justify-center gap-2 py-12"
        role="status"
      >
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        Checking your invite…
      </div>
    );
  } else if (getStatusCode(error) === 404) {
    content = (
      <InviteState
        icon={Link2Off}
        tone="destructive"
        title="This invite link isn't valid"
        actions={teamsLink}
      >
        The link may be incomplete, or the invite was revoked. Ask the person
        who invited you to send a new one.
      </InviteState>
    );
  } else if (error || !invite) {
    content = (
      <InviteState
        icon={MailWarning}
        tone="destructive"
        title="Couldn't load this invite"
        actions={
          <Button type="button" variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        }
      >
        {getErrorMessage(error)}
      </InviteState>
    );
  } else if (invite.alreadyMember) {
    content = (
      <InviteState
        icon={CheckCircle2}
        tone="success"
        title={`You're already in ${invite.workspaceName}`}
        actions={
          <Button asChild>
            <Link
              to={routes.WorkspaceRoute.to}
              params={{ workspaceId: invite.workspaceId }}
            >
              Open {invite.workspaceName}
            </Link>
          </Button>
        }
      >
        There's nothing left to do. You're already a member of this team.
      </InviteState>
    );
  } else if (invite.status === "expired") {
    content = (
      <InviteState
        icon={Clock}
        tone="warning"
        title="This invite has expired"
        actions={teamsLink}
      >
        Invites are only valid for a limited time. Ask {invite.invitedBy} to
        invite you to {invite.workspaceName} again.
      </InviteState>
    );
  } else if (invite.status === "accepted") {
    content = (
      <InviteState
        icon={Link2Off}
        tone="warning"
        title="This invite has already been used"
        actions={teamsLink}
      >
        Each invite link can only be used once. If you still need access to{" "}
        {invite.workspaceName}, ask {invite.invitedBy} for a new invite.
      </InviteState>
    );
  } else if (!invite.emailMatches) {
    content = (
      <InviteState
        icon={MailWarning}
        tone="warning"
        title="This invite is for a different email"
        actions={
          <>
            <Button type="button" onClick={() => logout()}>
              <LogOut aria-hidden="true" />
              Log out
            </Button>
            {teamsLink}
          </>
        }
      >
        <p>
          {invite.invitedBy} invited{" "}
          <span className="text-foreground font-medium">{invite.email}</span>{" "}
          to {invite.workspaceName}
          {user.email ? (
            <>
              , but you're logged in as{" "}
              <span className="text-foreground font-medium">{user.email}</span>
            </>
          ) : (
            ", but your account has no email address"
          )}
          .
        </p>
        <p className="mt-2">
          Log out, log in (or sign up) with {invite.email}, then open the
          invite link again.
        </p>
      </InviteState>
    );
  } else {
    content = (
      <InviteState
        icon={Users}
        tone="primary"
        title={`${invite.invitedBy} invited you to join ${invite.workspaceName}`}
        actions={
          <>
            <Button
              type="button"
              onClick={handleAccept}
              disabled={isAccepting}
            >
              {isAccepting ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <UserPlus aria-hidden="true" />
              )}
              Accept invite
            </Button>
            {teamsLink}
          </>
        }
      >
        <p>
          Teams on Daybloom share a task list. You can pick up tasks, get them
          assigned to you, and add them to your own AI-generated plan.
        </p>
        {acceptError && (
          <p role="alert" className="text-destructive mt-3">
            {acceptError}
          </p>
        )}
      </InviteState>
    );
  }

  return (
    <PageContainer>
      <Card className="mx-auto mt-6 max-w-lg hover:shadow">
        <CardContent className="pt-6">{content}</CardContent>
      </Card>
    </PageContainer>
  );
}

type Tone = "primary" | "success" | "warning" | "destructive";

const TONE_CLASSES: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

function InviteState({
  icon: Icon,
  tone,
  title,
  children,
  actions,
}: {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full",
          TONE_CLASSES[tone],
        )}
      >
        <Icon className="h-7 w-7" aria-hidden="true" />
      </div>
      <h1 className="text-foreground break-words text-xl font-semibold">
        {title}
      </h1>
      <div className="text-muted-foreground text-sm">{children}</div>
      <div className="flex flex-wrap justify-center gap-2">{actions}</div>
    </div>
  );
}
