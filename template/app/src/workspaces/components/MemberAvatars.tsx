import { Avatar, AvatarFallback } from "../../client/components/ui/avatar";
import type { WorkspaceMemberDetails } from "../operations";
import { getInitials, getUserLabel } from "./format";

const MAX_VISIBLE = 5;

export function MemberAvatars({
  members,
}: {
  members: WorkspaceMemberDetails[];
}) {
  const visible = members.slice(0, MAX_VISIBLE);
  const hiddenCount = members.length - visible.length;

  return (
    <div
      className="flex -space-x-2"
      role="list"
      aria-label={`${members.length} ${members.length === 1 ? "member" : "members"}`}
    >
      {visible.map((member) => (
        <Avatar
          key={member.userId}
          role="listitem"
          title={getUserLabel(member)}
          className="border-background h-8 w-8 border-2"
        >
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
            <span aria-hidden="true">{getInitials(member)}</span>
            <span className="sr-only">{getUserLabel(member)}</span>
          </AvatarFallback>
        </Avatar>
      ))}
      {hiddenCount > 0 && (
        <div
          role="listitem"
          className="border-background bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-medium"
          title={`${hiddenCount} more`}
        >
          +{hiddenCount}
        </div>
      )}
    </div>
  );
}
