"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Play,
  Square,
  RotateCcw,
  Eye,
  Trash2,
  Loader2,
} from "lucide-react";
import Link from "next/link";

interface ActionsDropdownProps {
  deploymentId: Id<"deployments">;
  status: string;
  onDelete: () => void;
}

export function ActionsDropdown({
  deploymentId,
  status,
  onDelete,
}: ActionsDropdownProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const startAction = useAction(api.lifecycleActions.start);
  const stopAction = useAction(api.lifecycleActions.stop);
  const restartAction = useAction(api.lifecycleActions.restart);

  const handleAction = async (
    actionName: string,
    fn: (args: { id: Id<"deployments"> }) => Promise<void>
  ) => {
    setLoading(actionName);
    try {
      await fn({ id: deploymentId });
    } catch (err) {
      console.error(`Failed to ${actionName}:`, err);
    } finally {
      setLoading(null);
    }
  };

  const isRunning = status === "running";
  const isStopped = status === "stopped";
  const isCreating = status === "creating";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/deployments/${deploymentId}`}>
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {isStopped && (
          <DropdownMenuItem
            onClick={() => handleAction("start", startAction)}
            disabled={!!loading}
          >
            <Play className="mr-2 h-4 w-4" />
            Start
          </DropdownMenuItem>
        )}
        {isRunning && (
          <DropdownMenuItem
            onClick={() => handleAction("stop", stopAction)}
            disabled={!!loading}
          >
            <Square className="mr-2 h-4 w-4" />
            Stop
          </DropdownMenuItem>
        )}
        {isRunning && (
          <DropdownMenuItem
            onClick={() => handleAction("restart", restartAction)}
            disabled={!!loading}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Restart
          </DropdownMenuItem>
        )}
        {!isCreating && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              disabled={!!loading}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
