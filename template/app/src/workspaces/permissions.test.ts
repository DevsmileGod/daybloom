import { describe, expect, it } from "vitest";
import {
  canChangeRole,
  canEditWorkspaceTask,
  canManageWorkspace,
  canRemoveMember,
  getInviteExpiry,
  getInviteStatus,
  INVITE_VALIDITY_DAYS,
  isValidEmail,
  isWorkspaceRole,
  normalizeEmail,
} from "./permissions";

describe("roles", () => {
  it("only owners manage a workspace", () => {
    expect(canManageWorkspace("owner")).toBe(true);
    expect(canManageWorkspace("member")).toBe(false);
    expect(canManageWorkspace("admin")).toBe(false);
  });

  it("recognizes valid roles", () => {
    expect(isWorkspaceRole("owner")).toBe(true);
    expect(isWorkspaceRole("member")).toBe(true);
    expect(isWorkspaceRole("guest")).toBe(false);
  });
});

describe("canRemoveMember", () => {
  const base = {
    actorUserId: "me",
    targetUserId: "them",
    targetRole: "member",
    ownerCount: 1,
  };

  it("lets owners remove members", () => {
    expect(canRemoveMember({ ...base, actorRole: "owner" })).toBe(true);
  });

  it("doesn't let members remove others", () => {
    expect(canRemoveMember({ ...base, actorRole: "member" })).toBe(false);
  });

  it("lets anyone leave", () => {
    expect(
      canRemoveMember({ ...base, actorRole: "member", targetUserId: "me" }),
    ).toBe(true);
  });

  it("never removes the last owner, even themselves", () => {
    expect(
      canRemoveMember({
        ...base,
        actorRole: "owner",
        targetUserId: "me",
        targetRole: "owner",
      }),
    ).toBe(false);
    expect(
      canRemoveMember({
        ...base,
        actorRole: "owner",
        targetUserId: "me",
        targetRole: "owner",
        ownerCount: 2,
      }),
    ).toBe(true);
  });
});

describe("canChangeRole", () => {
  it("lets owners promote members", () => {
    expect(
      canChangeRole({
        actorRole: "owner",
        targetRole: "member",
        newRole: "owner",
        ownerCount: 1,
      }),
    ).toBe(true);
  });

  it("refuses to demote the last owner", () => {
    expect(
      canChangeRole({
        actorRole: "owner",
        targetRole: "owner",
        newRole: "member",
        ownerCount: 1,
      }),
    ).toBe(false);
  });

  it("refuses members and unknown roles", () => {
    expect(
      canChangeRole({
        actorRole: "member",
        targetRole: "member",
        newRole: "owner",
        ownerCount: 1,
      }),
    ).toBe(false);
    expect(
      canChangeRole({
        actorRole: "owner",
        targetRole: "member",
        newRole: "superuser",
        ownerCount: 1,
      }),
    ).toBe(false);
  });
});

describe("canEditWorkspaceTask", () => {
  const task = { createdById: "creator", assigneeId: "assignee" };

  it("allows the creator, the assignee and owners", () => {
    expect(canEditWorkspaceTask({ role: "member", userId: "creator", task })).toBe(true);
    expect(canEditWorkspaceTask({ role: "member", userId: "assignee", task })).toBe(true);
    expect(canEditWorkspaceTask({ role: "owner", userId: "someone", task })).toBe(true);
  });

  it("refuses other members", () => {
    expect(canEditWorkspaceTask({ role: "member", userId: "someone", task })).toBe(false);
    expect(
      canEditWorkspaceTask({
        role: "member",
        userId: "someone",
        task: { createdById: "creator", assigneeId: null },
      }),
    ).toBe(false);
  });
});

describe("emails", () => {
  it("normalizes and validates addresses", () => {
    expect(normalizeEmail("  Mitch@Example.COM ")).toBe("mitch@example.com");
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("not an email")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
  });
});

describe("invites", () => {
  const now = new Date("2026-11-22T12:00:00Z");

  it("expire after the validity period", () => {
    const expiry = getInviteExpiry(now);
    expect(expiry.getTime() - now.getTime()).toBe(
      INVITE_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
    );
  });

  it("report their status", () => {
    const future = new Date("2026-11-29T12:00:00Z");
    const past = new Date("2026-11-21T12:00:00Z");
    expect(getInviteStatus({ expiresAt: future, acceptedAt: null }, now)).toBe("pending");
    expect(getInviteStatus({ expiresAt: past, acceptedAt: null }, now)).toBe("expired");
    expect(getInviteStatus({ expiresAt: past, acceptedAt: past }, now)).toBe("accepted");
  });
});
