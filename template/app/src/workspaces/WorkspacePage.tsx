import { ArrowLeft, Loader2, Pencil, SearchX } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import { getWorkspace, useQuery } from "wasp/client/operations";
import { Link, routes } from "wasp/client/router";
import { PageContainer, PageHeader } from "../client/components/PageHeader";
import { Button } from "../client/components/ui/button";
import { Card, CardContent } from "../client/components/ui/card";
import { getErrorMessage, getStatusCode } from "../client/errors";
import { DangerZone } from "./components/DangerZone";
import { InvitesPanel } from "./components/InvitesPanel";
import { MemberAvatars } from "./components/MemberAvatars";
import { MembersPanel } from "./components/MembersPanel";
import { RenameWorkspaceDialog } from "./components/RenameWorkspaceDialog";
import { RoleBadge } from "./components/RoleBadge";
import { WorkspaceTaskList } from "./components/WorkspaceTaskList";
import { canManageWorkspace } from "./permissions";

export function WorkspacePage() {
  const { workspaceId = "" } = useParams();
  const { data, isLoading, error, refetch } = useQuery(getWorkspace, {
    id: workspaceId,
  });
  const [isRenameOpen, setIsRenameOpen] = useState(false);

  if (isLoading) {
    return (
      <PageContainer>
        <BackLink />
        <div
          className="text-muted-foreground flex items-center justify-center gap-2 py-24"
          role="status"
        >
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Loading team…
        </div>
      </PageContainer>
    );
  }

  if (error || !data) {
    const isNotFound = getStatusCode(error) === 404;
    return (
      <PageContainer>
        <BackLink />
        <Card className="mx-auto mt-6 max-w-lg hover:shadow">
          <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
            <SearchX
              className="text-muted-foreground h-10 w-10"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <h1 className="text-foreground text-xl font-semibold">
                {isNotFound ? "Team not found" : "Couldn't load this team"}
              </h1>
              <p className="text-muted-foreground text-sm">
                {isNotFound
                  ? "This team doesn't exist, or you're not a member of it. If someone invited you, open the link from their email."
                  : getErrorMessage(error)}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {!isNotFound && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => refetch()}
                >
                  Try again
                </Button>
              )}
              <Button asChild>
                <Link to={routes.WorkspacesRoute.to}>Go to your teams</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  const { workspace, myRole, myUserId, members, invites, tasks } = data;
  const isOwner = canManageWorkspace(myRole);

  return (
    <PageContainer>
      <BackLink />
      <PageHeader
        className="mt-4"
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="break-words">{workspace.name}</span>
            {isOwner && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsRenameOpen(true)}
                aria-label="Rename team"
              >
                <Pencil aria-hidden="true" />
              </Button>
            )}
          </span>
        }
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <RoleBadge role={myRole} />
            <span>
              {members.length} {members.length === 1 ? "member" : "members"}
            </span>
          </span>
        }
        actions={<MemberAvatars members={members} />}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <WorkspaceTaskList
            workspaceId={workspace.id}
            tasks={tasks}
            members={members}
            myUserId={myUserId}
            myRole={myRole}
          />
        </div>
        <div className="min-w-0 space-y-6">
          <MembersPanel
            workspaceId={workspace.id}
            workspaceName={workspace.name}
            members={members}
            myUserId={myUserId}
            myRole={myRole}
          />
          {isOwner && (
            <InvitesPanel
              workspaceId={workspace.id}
              invites={invites}
              memberCount={members.length}
            />
          )}
          {isOwner && (
            <DangerZone
              workspaceId={workspace.id}
              workspaceName={workspace.name}
            />
          )}
        </div>
      </div>

      {isOwner && (
        <RenameWorkspaceDialog
          open={isRenameOpen}
          onOpenChange={setIsRenameOpen}
          workspaceId={workspace.id}
          currentName={workspace.name}
        />
      )}
    </PageContainer>
  );
}

function BackLink() {
  return (
    <Link
      to={routes.WorkspacesRoute.to}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      All teams
    </Link>
  );
}
