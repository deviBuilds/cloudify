"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Deployments
          </h2>
          <p className="text-muted-foreground">
            Manage your service deployments
          </p>
        </div>
        <Button asChild>
          <Link href="/deployments/new">
            <Plus className="mr-2 h-4 w-4" />
            New Deployment
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Deployments</CardTitle>
          <CardDescription>
            Real-time status of all managed deployments
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                      <Badge variant="outline">{d.serviceType}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          d.status === "running"
                            ? "default"
                            : d.status === "error"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {(d.domainUrls as Record<string, string> | undefined)?.dashboard ? (
                        <a
                          href={(d.domainUrls as Record<string, string>).dashboard}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {(d.domainUrls as Record<string, string>).dashboard.replace("https://", "")}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
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
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Container className="h-12 w-12 text-muted-foreground/50" />
              <div>
                <p className="font-medium">No deployments yet</p>
                <p className="text-sm text-muted-foreground">
                  Create your first deployment to get started
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
