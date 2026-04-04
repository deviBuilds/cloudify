"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Container, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionsDropdown } from "@/components/deployments/actions-dropdown";
import { DeleteDialog } from "@/components/deployments/delete-dialog";

export default function DeploymentsPage() {
  const deployments = useQuery(api.deployments.list);
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: Id<"deployments">;
    name: string;
  } | null>(null);

  const statusColors: Record<string, string> = {
    running: "bg-green-500",
    creating: "bg-blue-400",
    stopped: "bg-neutral-500",
    error: "bg-red-500",
    degraded: "bg-yellow-500",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">All Deployments</h3>
        <Button variant="outline" size="sm" asChild>
          <Link href="/deployments/new">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Deployment
          </Link>
        </Button>
      </div>

      {deployments && deployments.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {deployments.map((d) => (
              <TableRow
                key={d._id}
                className="cursor-pointer"
                onClick={() => router.push(`/deployments/${d._id}`)}
              >
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {d.serviceType}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${statusColors[d.status] ?? "bg-neutral-500"}`}
                    />
                    <span className="text-sm">{d.status}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {(d.domainUrls as Record<string, string> | undefined)?.dashboard ? (
                    <a
                      href={(d.domainUrls as Record<string, string>).dashboard}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(d.domainUrls as Record<string, string>).dashboard.replace("https://", "")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(d._creationTime).toLocaleDateString()}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <ActionsDropdown
                    deploymentId={d._id}
                    status={d.status}
                    onDelete={() =>
                      setDeleteTarget({ id: d._id, name: d.name })
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Container className="h-8 w-8 text-muted-foreground/30" />
            <div>
              <p className="text-sm font-medium">No deployments yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create your first deployment to get started.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild className="mt-2">
              <Link href="/deployments/new">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New Deployment
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {deleteTarget && (
        <DeleteDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          deploymentId={deleteTarget.id}
          deploymentName={deleteTarget.name}
        />
      )}
    </div>
  );
}
