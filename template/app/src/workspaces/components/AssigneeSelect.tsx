import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../client/components/ui/select";
import type { WorkspaceMemberDetails } from "../operations";
import { getUserLabel } from "./format";

// Radix Select doesn't allow an empty string as an item value.
const UNASSIGNED = "__unassigned__";

export function AssigneeSelect({
  id,
  value,
  onChange,
  members,
  myUserId,
  disabled,
  className,
  formerMemberLabel,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string | null;
  onChange: (assigneeId: string | null) => void;
  members: WorkspaceMemberDetails[];
  myUserId: string;
  disabled?: boolean;
  className?: string;
  /** Label for `value` when it points to someone who has left the team. */
  formerMemberLabel?: string;
  "aria-label"?: string;
}) {
  const formerMemberId =
    value !== null && !members.some((member) => member.userId === value)
      ? value
      : null;

  return (
    <Select
      value={value ?? UNASSIGNED}
      onValueChange={(nextValue) =>
        onChange(nextValue === UNASSIGNED ? null : nextValue)
      }
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className} aria-label={ariaLabel}>
        <SelectValue placeholder="Unassigned" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
        {formerMemberId !== null && (
          <SelectItem value={formerMemberId} disabled>
            {formerMemberLabel ?? "Former member"} (left the team)
          </SelectItem>
        )}
        {members.map((member) => (
          <SelectItem key={member.userId} value={member.userId}>
            {getUserLabel(member)}
            {member.userId === myUserId ? " (you)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
