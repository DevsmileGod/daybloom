import { Loader2, Mail, RotateCw, Send, X } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import {
  inviteToWorkspace,
  revokeWorkspaceInvite,
} from "wasp/client/operations";
import { Button } from "../../client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../client/components/ui/card";
import { Input } from "../../client/components/ui/input";
import { Label } from "../../client/components/ui/label";
import { getErrorMessage } from "../../client/errors";
import { toast } from "../../client/hooks/use-toast";
import { cn } from "../../client/utils";
import type { WorkspaceInviteDetails } from "../operations";
import {
  INVITE_VALIDITY_DAYS,
  isValidEmail,
  MAX_WORKSPACE_MEMBERS,
} from "../permissions";
import { formatDate } from "./format";

export function InvitesPanel({
  workspaceId,
  invites,
  memberCount,
}: {
  workspaceId: string;
  invites: WorkspaceInviteDetails[];
  memberCount: number;
}) {
  const inputId = useId();
  const [email, setEmail] = useState("");
  const [showEmailError, setShowEmailError] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);

  const isFull = memberCount >= MAX_WORKSPACE_MEMBERS;
  const emailIsValid = isValidEmail(email);
  const openInvites = invites.filter((invite) => invite.status !== "accepted");

  const sendInvite = async (address: string) => {
    await inviteToWorkspace({ workspaceId, email: address.trim() });
    toast({
      title: "Invite sent",
      description: `We emailed an invite link to ${address.trim()}.`,
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!emailIsValid) {
      setShowEmailError(true);
      return;
    }
    setIsSending(true);
    try {
      await sendInvite(email);
      setEmail("");
      setShowEmailError(false);
    } catch (err) {
      toast({
        title: "Couldn't send the invite",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleResend = async (invite: WorkspaceInviteDetails) => {
    setBusyInviteId(invite.id);
    try {
      await sendInvite(invite.email);
    } catch (err) {
      toast({
        title: "Couldn't resend the invite",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setBusyInviteId(null);
    }
  };

  const handleRevoke = async (invite: WorkspaceInviteDetails) => {
    setBusyInviteId(invite.id);
    try {
      await revokeWorkspaceInvite({ inviteId: invite.id });
      toast({ title: `Invite for ${invite.email} revoked` });
    } catch (err) {
      toast({
        title: "Couldn't revoke the invite",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setBusyInviteId(null);
    }
  };

  return (
    <Card className="hover:shadow">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2 text-lg">
          <Mail className="text-primary h-5 w-5" aria-hidden="true" />
          Invites
        </CardTitle>
        <CardDescription>
          Invite people by email. Links expire after {INVITE_VALIDITY_DAYS} days
          and only work for the address they were sent to.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} noValidate className="grid gap-2">
          <Label htmlFor={inputId}>Email address</Label>
          <div className="flex gap-2">
            <Input
              id={inputId}
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="teammate@example.com"
              value={email}
              maxLength={254}
              disabled={isFull}
              aria-invalid={showEmailError && !emailIsValid}
              aria-describedby={
                showEmailError && !emailIsValid ? `${inputId}-error` : undefined
              }
              onChange={(event) => setEmail(event.currentTarget.value)}
            />
            <Button
              type="submit"
              disabled={isSending || isFull || !email.trim()}
            >
              {isSending ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Send aria-hidden="true" />
              )}
              Invite
            </Button>
          </div>
          {showEmailError && !emailIsValid && (
            <p id={`${inputId}-error`} className="text-destructive text-sm">
              Enter a valid email address.
            </p>
          )}
          {isFull && (
            <p className="text-warning text-sm">
              This team has reached the limit of {MAX_WORKSPACE_MEMBERS}{" "}
              members.
            </p>
          )}
        </form>

        {openInvites.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
            No pending invites.
          </p>
        ) : (
          <ul className="divide-y" aria-label="Pending invites">
            {openInvites.map((invite) => {
              const isExpired = invite.status === "expired";
              const isBusy = busyInviteId === invite.id;
              return (
                <li
                  key={invite.id}
                  className="flex items-center gap-2 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-sm font-medium">
                      {invite.email}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      <span
                        className={cn(
                          "mr-1 inline-block rounded-full px-1.5 py-0.5 font-medium",
                          isExpired
                            ? "bg-warning/10 text-warning"
                            : "bg-success/10 text-success",
                        )}
                      >
                        {isExpired ? "Expired" : "Pending"}
                      </span>
                      {isExpired ? "Expired" : "Expires"}{" "}
                      {formatDate(invite.expiresAt)}
                    </p>
                  </div>
                  {isExpired && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={isBusy || isFull}
                      onClick={() => handleResend(invite)}
                      aria-label={`Resend invite to ${invite.email}`}
                      title="Resend"
                    >
                      <RotateCw aria-hidden="true" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive h-8 w-8"
                    disabled={isBusy}
                    onClick={() => handleRevoke(invite)}
                    aria-label={`Revoke invite to ${invite.email}`}
                    title="Revoke"
                  >
                    {isBusy ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : (
                      <X aria-hidden="true" />
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
