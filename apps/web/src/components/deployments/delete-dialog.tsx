"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deploymentId: Id<"deployments">;
  deploymentName: string;
  onDeleted?: () => void;
}

export function DeleteDialog({
  open,
  onOpenChange,
  deploymentId,
  deploymentName,
  onDeleted,
}: DeleteDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const deleteAction = useAction(api.actions.deleteDeployment.deleteDeployment);

  const canDelete = confirmText === deploymentName;

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    try {
      await deleteAction({ id: deploymentId });
      onOpenChange(false);
      onDeleted?.();
    } catch (err) {
      console.error("Failed to delete deployment:", err);
    } finally {
      setDeleting(false);
      setConfirmText("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Deployment</DialogTitle>
          <DialogDescription>
            This will permanently destroy all containers, volumes, DNS records,
            and proxy configurations for{" "}
            <span className="font-semibold text-foreground">
              {deploymentName}
            </span>
            . This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-4">
          <Label htmlFor="confirm">
            Type <span className="font-mono font-semibold">{deploymentName}</span> to confirm
          </Label>
          <Input
            id="confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={deploymentName}
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete || deleting}
          >
            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete Deployment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
