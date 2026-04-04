"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container, ExternalLink, MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { ActionsDropdown } from "@/components/deployments/actions-dropdown";
import { useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { DeleteDialog } from "@/components/deployments/delete-dialog";

const statusColors: Record<string, string> = {
  running: "bg-green-500",
  creating: "bg-blue-400",
  stopped: "bg-neutral-500",
  error: "bg-red-500",
  degraded: "bg-yellow-500",
};

export default function DashboardPage() {
  const deployments = useQuery(api.deployments.list);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: Id<"deployments">;
    name: string;
  } | null>(null);

  const total = deployments?.length ?? 0;
  const running =
    deployments?.filter((d) => d.status === "running").length ?? 0;
  const stopped =
    deployments?.filter((d) => d.status === "stopped").length ?? 0;
  const errors =
    deployments?.filter(
      (d) => d.status === "error" || d.status === "degraded"
    ).length ?? 0;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        {/* Left: Usage/Stats */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">
                Deployment Status
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-normal">
                Live
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Running", count: running, color: "bg-green-500" },
                { label: "Stopped", count: stopped, color: "bg-neutral-500" },
                { label: "Errors", count: errors, color: "bg-red-500" },
                { label: "Total", count: total, color: "bg-foreground" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2.5">
                    <span className={`h-2 w-2 rounded-full ${row.color}`} />
                    <span className="text-muted-foreground">{row.label}</span>
                  </div>
                  <span className="tabular-nums">{row.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right: Deployments Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Deployments</h3>
            <Button variant="outline" size="sm" asChild>
              <Link href="/deployments/new">
                Add New...
              </Link>
            </Button>
          </div>

          {deployments && deployments.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {deployments.map((d) => {
                const domainUrls = d.domainUrls as Record<string, string> | undefined;
                return (
                  <Card key={d._id} className="group relative">
                    <Link
                      href={`/deployments/${d._id}`}
                      className="absolute inset-0 z-0"
                    />
                    <CardContent className="relative z-10 space-y-3 p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`mt-0.5 h-[10px] w-[10px] rounded-full ${statusColors[d.status] ?? "bg-neutral-500"}`}
                          />
                          <div>
                            <p className="text-sm font-medium">{d.name}</p>
                            {domainUrls?.dashboard && (
                              <p className="text-xs text-muted-foreground">
                                {domainUrls.dashboard.replace("https://", "")}
                              </p>
                            )}
                          </div>
                        </div>
                        <div
                          className="relative z-20"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ActionsDropdown
                            deploymentId={d._id}
                            status={d.status}
                            onDelete={() =>
                              setDeleteTarget({ id: d._id, name: d.name })
                            }
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          {d.serviceType}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(d._creationTime).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
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
        </div>
      </div>

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
