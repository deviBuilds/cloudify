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
import { FolderKanban, Plus } from "lucide-react";
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
  const projects = useQuery(api.projects.list);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: Id<"deployments">;
    name: string;
  } | null>(null);

  const total = deployments?.length ?? 0;
  const running = deployments?.filter((d) => d.status === "running").length ?? 0;
  const stopped = deployments?.filter((d) => d.status === "stopped").length ?? 0;
  const errors = deployments?.filter((d) => d.status === "error" || d.status === "degraded").length ?? 0;

  // Group deployments by project
  const projectMap = new Map<string | undefined, typeof deployments>();
  if (deployments) {
    for (const d of deployments) {
      const key = d.projectId ?? undefined;
      if (!projectMap.has(key)) projectMap.set(key, []);
      projectMap.get(key)!.push(d);
    }
  }

  function getProjectName(projectId: string | undefined) {
    if (!projectId || !projects) return "Unassigned";
    const p = projects.find((p) => p._id === projectId);
    return p ? `${p.name} — ${p.domain}` : "Unknown";
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        {/* Left: Stats */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Overview</CardTitle>
              <Badge variant="outline" className="text-[10px] font-normal">Live</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Projects", count: projects?.length ?? 0, color: "bg-foreground" },
                { label: "Running", count: running, color: "bg-green-500" },
                { label: "Stopped", count: stopped, color: "bg-neutral-500" },
                { label: "Errors", count: errors, color: "bg-red-500" },
                { label: "Total Deployments", count: total, color: "bg-foreground" },
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

        {/* Right: Projects + Deployments */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Projects</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/projects/new">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New Project
                </Link>
              </Button>
            </div>
          </div>

          {projects && projects.length > 0 ? (
            <div className="space-y-6">
              {projects.map((project) => {
                const projectDeployments = deployments?.filter(
                  (d) => d.projectId === project._id
                ) ?? [];
                return (
                  <div key={project._id} className="space-y-3">
                    <Link
                      href={`/projects/${project._id}`}
                      className="flex items-center gap-2 group"
                    >
                      <span className="text-sm font-medium group-hover:underline">
                        {project.name}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {project.domain}
                      </Badge>
                      <span
                        className={`h-2 w-2 rounded-full ${
                          project.wildcardCertId ? "bg-green-500" : "bg-yellow-500"
                        }`}
                      />
                    </Link>

                    {projectDeployments.length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {projectDeployments.map((d) => {
                          const domainUrls = d.domainUrls as Record<string, string> | undefined;
                          return (
                            <Link key={d._id} href={`/deployments/${d._id}`} className="block">
                              <Card className="transition-colors hover:bg-accent/50">
                                <CardContent className="space-y-3 p-4">
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
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
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
                            </Link>
                          );
                        })}
                      </div>
                    ) : (
                      <Card>
                        <CardContent className="py-6 text-center">
                          <p className="text-xs text-muted-foreground">
                            No deployments yet.{" "}
                            <Link href="/deployments/new" className="underline">
                              Create one
                            </Link>
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                <FolderKanban className="h-8 w-8 text-muted-foreground/30" />
                <div>
                  <p className="text-sm font-medium">No projects yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create a project to start deploying services.
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild className="mt-2">
                  <Link href="/projects/new">
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    New Project
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
