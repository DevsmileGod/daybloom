export const WORKSPACE_ROLES = ["owner", "member"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const INVITE_VALIDITY_DAYS = 7;
export const MAX_WORKSPACE_MEMBERS = 25;

export function isWorkspaceRole(value: string): value is WorkspaceRole {
  return (WORKSPACE_ROLES as readonly string[]).includes(value);
}

/** Owners can rename/delete the workspace and manage members and invites. */
export function canManageWorkspace(role: string): boolean {
  return role === "owner";
}

/**
 * Owners can remove anyone except the last owner; members can only remove
 * themselves (i.e. leave).
 */
export function canRemoveMember({
  actorRole,
  actorUserId,
  targetUserId,
  targetRole,
  ownerCount,
}: {
  actorRole: string;
  actorUserId: string;
  targetUserId: string;
  targetRole: string;
  ownerCount: number;
}): boolean {
  const isLastOwner = targetRole === "owner" && ownerCount <= 1;
  if (isLastOwner) return false;
  if (actorUserId === targetUserId) return true;
  return canManageWorkspace(actorRole);
}

/** Owners can change roles, but the workspace must keep at least one owner. */
export function canChangeRole({
  actorRole,
  targetRole,
  newRole,
  ownerCount,
}: {
  actorRole: string;
  targetRole: string;
  newRole: string;
  ownerCount: number;
}): boolean {
  if (!canManageWorkspace(actorRole) || !isWorkspaceRole(newRole)) return false;
  const demotesLastOwner =
    targetRole === "owner" && newRole !== "owner" && ownerCount <= 1;
  return !demotesLastOwner;
}

/**
 * Any member can add tasks and tick off tasks; editing or deleting a task is
 * limited to its creator, its assignee and owners.
 */
export function canEditWorkspaceTask({
  role,
  userId,
  task,
}: {
  role: string;
  userId: string;
  task: { createdById: string; assigneeId: string | null };
}): boolean {
  return (
    canManageWorkspace(role) ||
    task.createdById === userId ||
    task.assigneeId === userId
  );
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export type InviteStatus = "pending" | "accepted" | "expired";

export function getInviteStatus(
  invite: { expiresAt: Date; acceptedAt: Date | null },
  now: Date = new Date(),
): InviteStatus {
  if (invite.acceptedAt) return "accepted";
  if (invite.expiresAt.getTime() <= now.getTime()) return "expired";
  return "pending";
}

export function getInviteExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITE_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
}
