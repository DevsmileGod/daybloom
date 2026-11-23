import { AlertTriangle, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { deleteWorkspace } from "wasp/client/operations";
import { routes } from "wasp/client/router";
import { Button } from "../../client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../client/components/ui/card";
import { toast } from "../../client/hooks/use-toast";
import { ConfirmDialog } from "./ConfirmDialog";

export function DangerZone({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string;
  workspaceName: string;
}) {
  const navigate = useNavigate();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const handleDelete = async () => {
    await deleteWorkspace({ id: workspaceId });
    toast({ title: `${workspaceName} was deleted` });
    navigate(routes.WorkspacesRoute.to);
  };

  return (
    <Card className="border-destructive/50 hover:shadow">
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          Danger zone
        </CardTitle>
        <CardDescription>
          Deleting the team removes its shared tasks, members and invites for
          everyone. This can't be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          variant="destructive"
          className="w-full"
          onClick={() => setIsDeleteOpen(true)}
        >
          <Trash2 aria-hidden="true" />
          Delete team
        </Button>
      </CardContent>

      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete this team?"
        description={
          <p>
            All shared tasks, members and pending invites of{" "}
            <span className="text-foreground font-medium">{workspaceName}</span>{" "}
            will be permanently deleted. Tasks members already added to their
            own plans are kept.
          </p>
        }
        confirmLabel="Delete team"
        confirmationText={workspaceName}
        onConfirm={handleDelete}
      />
    </Card>
  );
}
