"use client";

import { use, useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  RefreshCw,
  Shield,
  Loader2,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const statusColors: Record<string, string> = {
  running: "bg-green-500",
  creating: "bg-blue-400",
  stopped: "bg-neutral-500",
  error: "bg-red-500",
  degraded: "bg-yellow-500",
};

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectId = id as Id<"projects">;
  const project = useQuery(api.projects.get, { id: projectId });
  const deployments = useQuery(api.deployments.listByProject, { projectId });
  const validateCf = useAction(api.actions.projectActions.validateCloudflare);
  const discoverCert = useAction(api.actions.projectActions.discoverWildcardCert);
  const deleteProject = useMutation(api.projects.softDelete);
  const router = useRouter();

  const [cfStatus, setCfStatus] = useState<"idle" | "testing" | "connected" | "failed">("idle");
  const [certRefreshing, setCertRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleTestCf = async () => {
    if (!project) return;
    setCfStatus("testing");
    try {
      const res = await validateCf({
        apiToken: project.cloudflareApiToken,
        zoneId: project.cloudflareZoneId,
      });
      setCfStatus(res.connected ? "connected" : "failed");
    } catch {
      setCfStatus("failed");
    }
  };

  const handleRefreshCert = async () => {
    setCertRefreshing(true);
    try {
      await discoverCert({ projectId });
    } catch {
      // non-fatal
    } finally {
      setCertRefreshing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteProject({ id: projectId });
      router.push("/projects");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
  };

  if (!project) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h2 className="text-sm font-medium">{project.name}</h2>
          <p className="text-xs text-muted-foreground">{project.domain}</p>
        </div>
        {project.isDefault && (
          <Badge variant="outline" className="text-[10px] font-normal">
            Default
          </Badge>
        )}
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cloudflare</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              {cfStatus === "connected" && <Badge variant="default" className="text-xs">Connected</Badge>}
              {cfStatus === "failed" && <Badge variant="destructive" className="text-xs">Failed</Badge>}
              {cfStatus === "idle" && <Badge variant="secondary" className="text-xs">Not tested</Badge>}
              {cfStatus === "testing" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            </div>
            <Button variant="outline" size="sm" onClick={handleTestCf} disabled={cfStatus === "testing"}>
              <Shield className="mr-1.5 h-3.5 w-3.5" />
              Test
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Wildcard Cert</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge variant={project.wildcardCertId ? "default" : "secondary"} className="text-xs">
              {project.wildcardCertId ? `ID: ${project.wildcardCertId}` : "Not found"}
            </Badge>
            <Button variant="outline" size="sm" onClick={handleRefreshCert} disabled={certRefreshing}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${certRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Deployments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{deployments?.length ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Deployments */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Deployments</h3>
        {deployments && deployments.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {deployments.map((d) => {
              const domainUrls = d.domainUrls as Record<string, string> | undefined;
              return (
                <Link key={d._id} href={`/deployments/${d._id}`} className="block">
                  <Card className="transition-colors hover:bg-accent/50">
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`h-[10px] w-[10px] rounded-full ${statusColors[d.status] ?? "bg-neutral-500"}`}
                        />
                        <p className="text-sm font-medium">{d.name}</p>
                      </div>
                      {domainUrls?.dashboard && (
                        <p className="text-xs text-muted-foreground">
                          {domainUrls.dashboard.replace("https://", "")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No deployments in this project yet.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-sm text-destructive">Danger Zone</CardTitle>
          <CardDescription>Delete this project. All deployments must be removed first.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting || (deployments && deployments.length > 0)}
          >
            {deleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete Project
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
