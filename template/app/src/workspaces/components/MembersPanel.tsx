import { LogOut, UserMinus, Users } from "lucide-react";
import { useState } from "react";
import {
  changeWorkspaceMemberRole,
  removeWorkspaceMember,
} from "wasp/client/operations";
import { routes } from "wasp/client/router";
import { useNavigate } from "react-router";
import { Avatar, AvatarFallback } from "../../client/components/ui/avatar";
import { Button } from "../../client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../client/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../client/components/ui/select";
import { getErrorMessage } from "../../client/errors";
import { toast } from "../../client/hooks/use-toast";
import type { WorkspaceMemberDetails } from "../operations";
import {
  canChangeRole,
  canManageWorkspace,
  canRemoveMember,
  isWorkspaceRole,
  MAX_WORKSPACE_MEMBERS,
  WORKSPACE_ROLES,
  type WorkspaceRole,
} from "../permissions";
import { ConfirmDialog } from "./ConfirmDialog";
import { formatDate, getInitials, getUserLabel } from "./format";
import { RoleBadge } from "./RoleBadge";

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  member: "Member",
};

export function MembersPanel({
  workspaceId,
  workspaceName,
  members,
  myUserId,
  myRole,
}: {
  workspaceId: string;
  workspaceName: string;
  members: WorkspaceMemberDetails[];
  myUserId: string;
  myRole: string;
}) {
  const navigate = useNavigate();
  const [memberToRemove, setMemberToRemove] =
    useState<WorkspaceMemberDetails | null>(null);
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [changingRoleFor, setChangingRoleFor] = useState<string | null>(null);

  const isOwner = canManageWorkspace(myRole);
  const ownerCount = members.filter((member) =>
    canManageWorkspace(member.role),
  ).length;
  const isLastOwner = isOwner && ownerCount <= 1;

  const handleRoleChange = async (
    member: WorkspaceMemberDetails,
    newRole: string,
  ) => {
    if (!isWorkspaceRole(newRole) || newRole === member.role) return;
    setChangingRoleFor(member.userId);
    try {
      await changeWorkspaceMemberRole({
        workspaceId,
        userId: member.userId,
        role: newRole,
      });
      toast({
        title: `${getUserLabel(member)} is now ${
          newRole === "owner" ? "an owner" : "a member"
        }`,
      });
    } catch (err) {
      toast({
        title: "Couldn't change the role",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setChangingRoleFor(null);
    }
  };

  const handleRemove = async () => {
    if (!memberToRemove) return;
    await removeWorkspaceMember({
      workspaceId,
      userId: memberToRemove.userId,
    });
    toast({ title: `${getUserLabel(memberToRemove)} was removed` });
    setMemberToRemove(null);
  };

  const handleLeave = async () => {
    await removeWorkspaceMember({ workspaceId, userId: myUserId });
    toast({ title: `You left ${workspaceName}` });
    navigate(routes.WorkspacesRoute.to);
  };

  return (
    <Card className="hover:shadow">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2 text-lg">
          <Users className="text-primary h-5 w-5" aria-hidden="true" />
          Members
        </CardTitle>
        <CardDescription>
          {members.length} of {MAX_WORKSPACE_MEMBERS} seats used.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y" aria-label="Team members">
          {members.map((member) => {
            const isMe = member.userId === myUserId;
            const label = getUserLabel(member);
            const canRemove =
              !isMe &&
              canRemoveMember({
                actorRole: myRole,
                actorUserId: myUserId,
                targetUserId: member.userId,
                targetRole: member.role,
                ownerCount,
              });
            const roleOptions = WORKSPACE_ROLES.filter(
              (role) =>
                role === member.role ||
                canChangeRole({
                  actorRole: myRole,
                  targetRole: member.role,
                  newRole: role,
                  ownerCount,
                }),
            );
            const canEditRole = isOwner && roleOptions.length > 1;

            return (
              <li
                key={member.userId}
                className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                    {getInitials(member)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-medium">
                    {label}
                    {isMe && (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        (you)
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {member.username && member.email
                      ? `${member.email} · `
                      : ""}
                    Joined {formatDate(member.joinedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {canEditRole ? (
                    <Select
                      value={member.role}
                      onValueChange={(value) => handleRoleChange(member, value)}
                      disabled={changingRoleFor === member.userId}
                    >
                      <SelectTrigger
                        className="h-8 w-[7.5rem] text-xs"
                        aria-label={`Role of ${label}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <RoleBadge role={member.role} />
                  )}
                  {canRemove && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive h-8 w-8"
                      onClick={() => setMemberToRemove(member)}
                      aria-label={`Remove ${label} from the team`}
                    >
                      <UserMinus aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setIsLeaveOpen(true)}
        >
          <LogOut aria-hidden="true" />
          Leave team
        </Button>
      </CardContent>

      <ConfirmDialog
        open={memberToRemove !== null}
        onOpenChange={(open) => {
          if (!open) setMemberToRemove(null);
        }}
        title="Remove member?"
        description={
          <p>
            {memberToRemove ? getUserLabel(memberToRemove) : "This member"}{" "}
            will lose access to {workspaceName}. Their open tasks become
            unassigned.
          </p>
        }
        confirmLabel="Remove"
        onConfirm={handleRemove}
      />

      <ConfirmDialog
        open={isLeaveOpen}
        onOpenChange={setIsLeaveOpen}
        title={`Leave ${workspaceName}?`}
        description={
          <div className="space-y-2">
            <p>
              You'll lose access to this team's shared tasks. Your open tasks
              here become unassigned. Copies already in your own plan are kept.
            </p>
            {isLastOwner && (
              <p className="text-warning">
                You're the only owner. Make someone else an owner first, or
                delete the team instead.
              </p>
            )}
          </div>
        }
        confirmLabel="Leave team"
        onConfirm={handleLeave}
      />
    </Card>
  );
}
