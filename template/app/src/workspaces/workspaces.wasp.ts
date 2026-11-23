import { action, page, query, route, type Spec } from "@wasp/spec";

import {
  acceptWorkspaceInvite,
  changeWorkspaceMemberRole,
  copyWorkspaceTaskToMyTasks,
  createWorkspace,
  createWorkspaceTask,
  deleteWorkspace,
  deleteWorkspaceTask,
  getMyWorkspaces,
  getWorkspace,
  getWorkspaceInvite,
  inviteToWorkspace,
  removeWorkspaceMember,
  renameWorkspace,
  revokeWorkspaceInvite,
  updateWorkspaceTask,
} from "./operations" with { type: "ref" };
import { WorkspaceInvitePage } from "./WorkspaceInvitePage" with { type: "ref" };
import { WorkspacePage } from "./WorkspacePage" with { type: "ref" };
import { WorkspacesPage } from "./WorkspacesPage" with { type: "ref" };

export const workspacesSpec: Spec = [
  route(
    "WorkspacesRoute",
    "/teams",
    page(WorkspacesPage, { authRequired: true }),
  ),
  route(
    "WorkspaceRoute",
    "/teams/:workspaceId",
    page(WorkspacePage, { authRequired: true }),
  ),
  route(
    "WorkspaceInviteRoute",
    "/invite/:token",
    page(WorkspaceInvitePage, { authRequired: true }),
  ),

  query(getMyWorkspaces, {
    entities: ["Workspace", "WorkspaceMember", "WorkspaceTask"],
  }),
  query(getWorkspace, {
    entities: [
      "Workspace",
      "WorkspaceMember",
      "WorkspaceInvite",
      "WorkspaceTask",
      "User",
    ],
  }),
  query(getWorkspaceInvite, {
    entities: ["WorkspaceInvite", "WorkspaceMember", "Workspace", "User"],
  }),

  action(createWorkspace, { entities: ["Workspace", "WorkspaceMember"] }),
  action(renameWorkspace, { entities: ["Workspace", "WorkspaceMember"] }),
  action(deleteWorkspace, { entities: ["Workspace", "WorkspaceMember"] }),
  action(inviteToWorkspace, {
    entities: ["Workspace", "WorkspaceMember", "WorkspaceInvite", "User"],
  }),
  action(revokeWorkspaceInvite, {
    entities: ["WorkspaceInvite", "WorkspaceMember"],
  }),
  action(acceptWorkspaceInvite, {
    entities: ["WorkspaceInvite", "WorkspaceMember"],
  }),
  action(removeWorkspaceMember, {
    entities: ["WorkspaceMember", "WorkspaceTask"],
  }),
  action(changeWorkspaceMemberRole, { entities: ["WorkspaceMember"] }),
  action(createWorkspaceTask, {
    entities: ["WorkspaceTask", "WorkspaceMember"],
  }),
  action(updateWorkspaceTask, {
    entities: ["WorkspaceTask", "WorkspaceMember"],
  }),
  action(deleteWorkspaceTask, {
    entities: ["WorkspaceTask", "WorkspaceMember"],
  }),
  action(copyWorkspaceTaskToMyTasks, {
    entities: ["WorkspaceTask", "WorkspaceMember", "Workspace", "Task"],
  }),
];
