import { Crown, User } from "lucide-react";
import { cn } from "../../client/utils";
import { canManageWorkspace } from "../permissions";

export function RoleBadge({
  role,
  className,
}: {
  role: string;
  className?: string;
}) {
  const isOwner = canManageWorkspace(role);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        isOwner
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {isOwner ? (
        <Crown className="h-3 w-3" aria-hidden="true" />
      ) : (
        <User className="h-3 w-3" aria-hidden="true" />
      )}
      {isOwner ? "Owner" : "Member"}
    </span>
  );
}
