import { randomBytes } from "crypto";
import { routes } from "wasp/client/router";
import type {
  Task,
  Workspace,
  WorkspaceMember,
  WorkspaceTask,
} from "wasp/entities";
import { config, HttpError, type PrismaClient } from "wasp/server";
import { emailSender } from "wasp/server/email";
import type {
  AcceptWorkspaceInvite,
  ChangeWorkspaceMemberRole,
  CopyWorkspaceTaskToMyTasks,
  CreateWorkspace,
  CreateWorkspaceTask,
  DeleteWorkspace,
  DeleteWorkspaceTask,
  GetMyWorkspaces,
  GetWorkspace,
  GetWorkspaceInvite,
  InviteToWorkspace,
  RemoveWorkspaceMember,
  RenameWorkspace,
  RevokeWorkspaceInvite,
  UpdateWorkspaceTask,
} from "wasp/server/operations";
import * as z from "zod";
import { isValidDateKey } from "../planner/lib/dates";
import { escapeHtml } from "../reminders/reminders";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import {
  canChangeRole,
  canEditWorkspaceTask,
  canManageWorkspace,
  canRemoveMember,
  getInviteExpiry,
  getInviteStatus,
  INVITE_VALIDITY_DAYS,
  type InviteStatus,
  MAX_WORKSPACE_MEMBERS,
  normalizeEmail,
  WORKSPACE_ROLES,
} from "./permissions";

//#region Types returned to the client

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: string;
  memberCount: number;
  openTaskCount: number;
  createdAt: Date;
}

export interface WorkspaceUser {
  id: string;
  email: string | null;
  username: string | null;
}

export interface WorkspaceMemberDetails {
  userId: string;
  role: string;
  joinedAt: Date;
  email: string | null;
  username: string | null;
}

export interface WorkspaceInviteDetails {
  id: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
  status: InviteStatus;
}

export type WorkspaceTaskDetails = WorkspaceTask & {
  assignee: WorkspaceUser | null;
  createdBy: WorkspaceUser;
};

export interface WorkspaceDetails {
  workspace: Workspace;
  myRole: string;
  myUserId: string;
  members: WorkspaceMemberDetails[];
  /** Only filled for owners. */
  invites: WorkspaceInviteDetails[];
  tasks: WorkspaceTaskDetails[];
}

export interface WorkspaceInvitePreview {
  workspaceId: string;
  workspaceName: string;
  invitedBy: string;
  email: string;
  status: InviteStatus;
  /** Whether the logged-in user's email matches the invited email. */
  emailMatches: boolean;
  alreadyMember: boolean;
}

//#endregion

const idSchema = z.string().nonempty();
const nameSchema = z.string().trim().min(1).max(80);
const hoursSchema = z
  .string()
  .trim()
  .refine(
    (value) => {
      const hours = Number.parseFloat(value);
      return Number.isFinite(hours) && hours > 0 && hours <= 24;
    },
    { message: "Time must be between 0 and 24 hours" },
  );
const dateKeySchema = z
  .string()
  .refine(isValidDateKey, { message: "Expected a date in YYYY-MM-DD format" });

const userSelect = { id: true, email: true, username: true } as const;

function requireUser<T>(user: T | undefined): T {
  if (!user) {
    throw new HttpError(401, "You need to be logged in to do that");
  }
  return user;
}

function displayName(user: { email: string | null; username: string | null }) {
  return user.username ?? user.email ?? "A Daybloom user";
}

/** The caller's membership, or 404 so non-members can't probe workspace ids. */
async function requireMembership(
  memberDelegate: PrismaClient["workspaceMember"],
  workspaceId: string,
  userId: string,
): Promise<WorkspaceMember> {
  const membership = await memberDelegate.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!membership) {
    throw new HttpError(404, "Workspace not found");
  }
  return membership;
}

async function requireOwner(
  memberDelegate: PrismaClient["workspaceMember"],
  workspaceId: string,
  userId: string,
): Promise<WorkspaceMember> {
  const membership = await requireMembership(
    memberDelegate,
    workspaceId,
    userId,
  );
  if (!canManageWorkspace(membership.role)) {
    throw new HttpError(403, "Only workspace owners can do that");
  }
  return membership;
}

async function countOwners(
  memberDelegate: PrismaClient["workspaceMember"],
  workspaceId: string,
): Promise<number> {
  return memberDelegate.count({ where: { workspaceId, role: "owner" } });
}

//#region Workspaces

export const createWorkspace: CreateWorkspace<
  { name: string },
  Workspace
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { name } = ensureArgsSchemaOrThrowHttpError(
    z.object({ name: nameSchema }),
    rawArgs,
  );
  return context.entities.Workspace.create({
    data: {
      name,
      members: { create: { userId: user.id, role: "owner" } },
    },
  });
};

export const renameWorkspace: RenameWorkspace<
  { id: string; name: string },
  Workspace
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { id, name } = ensureArgsSchemaOrThrowHttpError(
    z.object({ id: idSchema, name: nameSchema }),
    rawArgs,
  );
  await requireOwner(context.entities.WorkspaceMember, id, user.id);
  return context.entities.Workspace.update({ where: { id }, data: { name } });
};

export const deleteWorkspace: DeleteWorkspace<
  { id: string },
  { id: string }
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { id } = ensureArgsSchemaOrThrowHttpError(
    z.object({ id: idSchema }),
    rawArgs,
  );
  await requireOwner(context.entities.WorkspaceMember, id, user.id);
  await context.entities.Workspace.delete({ where: { id } });
  return { id };
};

export const getMyWorkspaces: GetMyWorkspaces<
  void,
  WorkspaceSummary[]
> = async (_args, context) => {
  const user = requireUser(context.user);
  const memberships = await context.entities.WorkspaceMember.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: {
      workspace: {
        include: {
          _count: {
            select: {
              members: true,
              tasks: { where: { isDone: false } },
            },
          },
        },
      },
    },
  });
  return memberships.map(({ role, workspace }) => ({
    id: workspace.id,
    name: workspace.name,
    createdAt: workspace.createdAt,
    role,
    memberCount: workspace._count.members,
    openTaskCount: workspace._count.tasks,
  }));
};

export const getWorkspace: GetWorkspace<
  { id: string },
  WorkspaceDetails
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { id } = ensureArgsSchemaOrThrowHttpError(
    z.object({ id: idSchema }),
    rawArgs,
  );
  const membership = await requireMembership(
    context.entities.WorkspaceMember,
    id,
    user.id,
  );

  const workspace = await context.entities.Workspace.findUniqueOrThrow({
    where: { id },
    include: {
      members: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: userSelect } },
      },
      tasks: {
        orderBy: [{ isDone: "asc" }, { createdAt: "desc" }],
        include: {
          assignee: { select: userSelect },
          createdBy: { select: userSelect },
        },
      },
      invites: {
        where: { acceptedAt: null },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const now = new Date();
  // Invite addresses are only shown to owners.
  const invites = canManageWorkspace(membership.role) ? workspace.invites : [];

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      createdAt: workspace.createdAt,
    },
    myRole: membership.role,
    myUserId: user.id,
    members: workspace.members.map((member) => ({
      userId: member.userId,
      role: member.role,
      joinedAt: member.createdAt,
      email: member.user.email,
      username: member.user.username,
    })),
    invites: invites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
      status: getInviteStatus(invite, now),
    })),
    tasks: workspace.tasks,
  };
};

//#endregion

//#region Members and invites

const inviteInputSchema = z.object({
  workspaceId: idSchema,
  email: z.string().trim().email().max(254),
});

export const inviteToWorkspace: InviteToWorkspace<
  z.infer<typeof inviteInputSchema>,
  WorkspaceInviteDetails
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { workspaceId, email: rawEmail } = ensureArgsSchemaOrThrowHttpError(
    inviteInputSchema,
    rawArgs,
  );
  const email = normalizeEmail(rawEmail);
  await requireOwner(context.entities.WorkspaceMember, workspaceId, user.id);

  const workspace = await context.entities.Workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    include: { members: { include: { user: { select: userSelect } } } },
  });
  // Pending invites reserve a seat, so owners can't invite more people than
  // the workspace can hold. A re-invite to the same address replaces its
  // earlier invite below, so that one isn't counted.
  const pendingInviteCount = await context.entities.WorkspaceInvite.count({
    where: {
      workspaceId,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
      email: { not: email },
    },
  });
  if (workspace.members.length + pendingInviteCount >= MAX_WORKSPACE_MEMBERS) {
    throw new HttpError(
      400,
      `A workspace can have at most ${MAX_WORKSPACE_MEMBERS} members, including pending invites`,
    );
  }
  const isAlreadyMember = workspace.members.some(
    (member) =>
      member.user.email && normalizeEmail(member.user.email) === email,
  );
  if (isAlreadyMember) {
    throw new HttpError(400, "That person is already in this workspace");
  }

  // Replace any earlier pending invite for the same address.
  await context.entities.WorkspaceInvite.deleteMany({
    where: { workspaceId, email, acceptedAt: null },
  });

  const token = randomBytes(24).toString("base64url");
  const invite = await context.entities.WorkspaceInvite.create({
    data: {
      workspace: { connect: { id: workspaceId } },
      invitedBy: { connect: { id: user.id } },
      email,
      token,
      expiresAt: getInviteExpiry(),
    },
  });

  const inviteUrl = `${config.frontendUrl}${routes.WorkspaceInviteRoute.build({
    params: { token },
  })}`;
  const inviter = displayName(user);
  await emailSender.send({
    to: email,
    subject: `${inviter} invited you to "${workspace.name}" on Daybloom`,
    text: `${inviter} invited you to join the "${workspace.name}" workspace on Daybloom, where you can share and plan tasks together.\n\nAccept the invite: ${inviteUrl}\n\nThis link expires in ${INVITE_VALIDITY_DAYS} days. If you weren't expecting this, you can ignore this email.`,
    html: `<p>${escapeHtml(inviter)} invited you to join the <strong>${escapeHtml(workspace.name)}</strong> workspace on Daybloom, where you can share and plan tasks together.</p><p><a href="${escapeHtml(inviteUrl)}">Accept the invite</a></p><p style="color:#6b7280;font-size:12px">This link expires in ${INVITE_VALIDITY_DAYS} days. If you weren't expecting this, you can ignore this email.</p>`,
  });

  return {
    id: invite.id,
    email: invite.email,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    status: getInviteStatus(invite),
  };
};

export const revokeWorkspaceInvite: RevokeWorkspaceInvite<
  { inviteId: string },
  { id: string }
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { inviteId } = ensureArgsSchemaOrThrowHttpError(
    z.object({ inviteId: idSchema }),
    rawArgs,
  );
  const invite = await context.entities.WorkspaceInvite.findUnique({
    where: { id: inviteId },
  });
  if (!invite) {
    throw new HttpError(404, "Invite not found");
  }
  await requireOwner(
    context.entities.WorkspaceMember,
    invite.workspaceId,
    user.id,
  );
  await context.entities.WorkspaceInvite.delete({ where: { id: invite.id } });
  return { id: invite.id };
};

export const getWorkspaceInvite: GetWorkspaceInvite<
  { token: string },
  WorkspaceInvitePreview
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { token } = ensureArgsSchemaOrThrowHttpError(
    z.object({ token: idSchema }),
    rawArgs,
  );
  const invite = await context.entities.WorkspaceInvite.findUnique({
    where: { token },
    include: {
      workspace: { select: { id: true, name: true } },
      invitedBy: { select: userSelect },
    },
  });
  if (!invite) {
    throw new HttpError(404, "This invite link is not valid");
  }
  const membership = await context.entities.WorkspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: invite.workspaceId, userId: user.id },
    },
  });
  return {
    workspaceId: invite.workspace.id,
    workspaceName: invite.workspace.name,
    invitedBy: displayName(invite.invitedBy),
    email: invite.email,
    status: getInviteStatus(invite),
    emailMatches: !!user.email && normalizeEmail(user.email) === invite.email,
    alreadyMember: !!membership,
  };
};

export const acceptWorkspaceInvite: AcceptWorkspaceInvite<
  { token: string },
  { workspaceId: string }
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { token } = ensureArgsSchemaOrThrowHttpError(
    z.object({ token: idSchema }),
    rawArgs,
  );
  const invite = await context.entities.WorkspaceInvite.findUnique({
    where: { token },
  });
  if (!invite) {
    throw new HttpError(404, "This invite link is not valid");
  }
  const status = getInviteStatus(invite);
  if (status === "expired") {
    throw new HttpError(410, "This invite has expired. Ask for a new one.");
  }
  if (status === "accepted") {
    throw new HttpError(410, "This invite has already been used");
  }
  // Invites are tied to the invited address, so a forwarded link can't be
  // used by someone else.
  if (!user.email || normalizeEmail(user.email) !== invite.email) {
    throw new HttpError(
      403,
      `This invite was sent to ${invite.email}. Log in with that email to accept it.`,
    );
  }

  const memberCount = await context.entities.WorkspaceMember.count({
    where: { workspaceId: invite.workspaceId },
  });
  if (memberCount >= MAX_WORKSPACE_MEMBERS) {
    throw new HttpError(400, "This workspace is full");
  }

  await context.entities.WorkspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: invite.workspaceId, userId: user.id },
    },
    create: {
      workspace: { connect: { id: invite.workspaceId } },
      user: { connect: { id: user.id } },
      role: "member",
    },
    update: {},
  });
  await context.entities.WorkspaceInvite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });

  return { workspaceId: invite.workspaceId };
};

const memberInputSchema = z.object({
  workspaceId: idSchema,
  userId: idSchema,
});

/** Removes a member, or lets a member leave when `userId` is their own. */
export const removeWorkspaceMember: RemoveWorkspaceMember<
  z.infer<typeof memberInputSchema>,
  { userId: string }
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { workspaceId, userId } = ensureArgsSchemaOrThrowHttpError(
    memberInputSchema,
    rawArgs,
  );
  const actor = await requireMembership(
    context.entities.WorkspaceMember,
    workspaceId,
    user.id,
  );
  const target = await requireMembership(
    context.entities.WorkspaceMember,
    workspaceId,
    userId,
  );
  const ownerCount = await countOwners(
    context.entities.WorkspaceMember,
    workspaceId,
  );
  if (
    !canRemoveMember({
      actorRole: actor.role,
      actorUserId: user.id,
      targetUserId: userId,
      targetRole: target.role,
      ownerCount,
    })
  ) {
    throw new HttpError(
      403,
      target.role === "owner" && ownerCount <= 1
        ? "A workspace needs at least one owner. Make someone else an owner first, or delete the workspace."
        : "Only workspace owners can remove other members",
    );
  }

  await context.entities.WorkspaceMember.delete({ where: { id: target.id } });
  // Unassign their open tasks so nothing is stuck on someone who left.
  await context.entities.WorkspaceTask.updateMany({
    where: { workspaceId, assigneeId: userId, isDone: false },
    data: { assigneeId: null },
  });
  return { userId };
};

const changeRoleInputSchema = memberInputSchema.extend({
  role: z.enum(WORKSPACE_ROLES),
});

export const changeWorkspaceMemberRole: ChangeWorkspaceMemberRole<
  z.infer<typeof changeRoleInputSchema>,
  WorkspaceMember
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { workspaceId, userId, role } = ensureArgsSchemaOrThrowHttpError(
    changeRoleInputSchema,
    rawArgs,
  );
  const actor = await requireMembership(
    context.entities.WorkspaceMember,
    workspaceId,
    user.id,
  );
  const target = await requireMembership(
    context.entities.WorkspaceMember,
    workspaceId,
    userId,
  );
  const ownerCount = await countOwners(
    context.entities.WorkspaceMember,
    workspaceId,
  );
  if (
    !canChangeRole({
      actorRole: actor.role,
      targetRole: target.role,
      newRole: role,
      ownerCount,
    })
  ) {
    throw new HttpError(
      403,
      canManageWorkspace(actor.role)
        ? "A workspace needs at least one owner"
        : "Only workspace owners can change roles",
    );
  }
  return context.entities.WorkspaceMember.update({
    where: { id: target.id },
    data: { role },
  });
};

//#endregion

//#region Shared tasks

const createWorkspaceTaskInputSchema = z.object({
  workspaceId: idSchema,
  description: z.string().trim().min(1).max(500),
  time: hoursSchema.default("1"),
  assigneeId: idSchema.nullable().optional(),
  dueDate: dateKeySchema.nullable().optional(),
});

async function assertAssigneeIsMember(
  memberDelegate: PrismaClient["workspaceMember"],
  workspaceId: string,
  assigneeId: string | null | undefined,
) {
  if (!assigneeId) return;
  const membership = await memberDelegate.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: assigneeId } },
  });
  if (!membership) {
    throw new HttpError(400, "Tasks can only be assigned to workspace members");
  }
}

export const createWorkspaceTask: CreateWorkspaceTask<
  z.input<typeof createWorkspaceTaskInputSchema>,
  WorkspaceTask
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { workspaceId, description, time, assigneeId, dueDate } =
    ensureArgsSchemaOrThrowHttpError(createWorkspaceTaskInputSchema, rawArgs);
  await requireMembership(
    context.entities.WorkspaceMember,
    workspaceId,
    user.id,
  );
  await assertAssigneeIsMember(
    context.entities.WorkspaceMember,
    workspaceId,
    assigneeId,
  );

  return context.entities.WorkspaceTask.create({
    data: {
      workspace: { connect: { id: workspaceId } },
      createdBy: { connect: { id: user.id } },
      ...(assigneeId ? { assignee: { connect: { id: assigneeId } } } : {}),
      description,
      time,
      dueDate: dueDate ?? null,
    },
  });
};

const updateWorkspaceTaskInputSchema = z.object({
  id: idSchema,
  isDone: z.boolean().optional(),
  description: z.string().trim().min(1).max(500).optional(),
  time: hoursSchema.optional(),
  assigneeId: idSchema.nullable().optional(),
  dueDate: dateKeySchema.nullable().optional(),
});

export const updateWorkspaceTask: UpdateWorkspaceTask<
  z.infer<typeof updateWorkspaceTaskInputSchema>,
  WorkspaceTask
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { id, isDone, ...changes } = ensureArgsSchemaOrThrowHttpError(
    updateWorkspaceTaskInputSchema,
    rawArgs,
  );
  const task = await context.entities.WorkspaceTask.findUnique({
    where: { id },
  });
  if (!task) {
    throw new HttpError(404, "Task not found");
  }
  const membership = await requireMembership(
    context.entities.WorkspaceMember,
    task.workspaceId,
    user.id,
  );

  const editsDetails = Object.values(changes).some(
    (value) => value !== undefined,
  );
  if (
    editsDetails &&
    !canEditWorkspaceTask({ role: membership.role, userId: user.id, task })
  ) {
    throw new HttpError(
      403,
      "Only the task's creator, its assignee or an owner can edit it",
    );
  }
  await assertAssigneeIsMember(
    context.entities.WorkspaceMember,
    task.workspaceId,
    changes.assigneeId,
  );

  return context.entities.WorkspaceTask.update({
    where: { id: task.id },
    data: {
      isDone,
      description: changes.description,
      time: changes.time,
      dueDate: changes.dueDate,
      assigneeId: changes.assigneeId,
    },
  });
};

export const deleteWorkspaceTask: DeleteWorkspaceTask<
  { id: string },
  { id: string }
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { id } = ensureArgsSchemaOrThrowHttpError(
    z.object({ id: idSchema }),
    rawArgs,
  );
  const task = await context.entities.WorkspaceTask.findUnique({
    where: { id },
  });
  if (!task) {
    throw new HttpError(404, "Task not found");
  }
  const membership = await requireMembership(
    context.entities.WorkspaceMember,
    task.workspaceId,
    user.id,
  );
  if (!canEditWorkspaceTask({ role: membership.role, userId: user.id, task })) {
    throw new HttpError(
      403,
      "Only the task's creator, its assignee or an owner can delete it",
    );
  }
  await context.entities.WorkspaceTask.delete({ where: { id: task.id } });
  return { id: task.id };
};

/**
 * Copies a shared task into the caller's personal task list, so it is
 * included the next time they generate a plan.
 */
export const copyWorkspaceTaskToMyTasks: CopyWorkspaceTaskToMyTasks<
  { id: string },
  Task
> = async (rawArgs, context) => {
  const user = requireUser(context.user);
  const { id } = ensureArgsSchemaOrThrowHttpError(
    z.object({ id: idSchema }),
    rawArgs,
  );
  const task = await context.entities.WorkspaceTask.findUnique({
    where: { id },
    include: { workspace: { select: { name: true } } },
  });
  if (!task) {
    throw new HttpError(404, "Task not found");
  }
  await requireMembership(
    context.entities.WorkspaceMember,
    task.workspaceId,
    user.id,
  );
  return context.entities.Task.create({
    data: {
      user: { connect: { id: user.id } },
      description: `${task.description} (${task.workspace.name})`,
      time: task.time,
    },
  });
};

//#endregion
