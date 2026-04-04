"use client";

import { use, useState, useRef, useEffect } from "react";
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
  Pencil,
  Check,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getStatusColor } from "@/lib/status";

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
  const updateProject = useMutation(api.projects.update);
  const router = useRouter();

  const [cfStatus, setCfStatus] = useState<"idle" | "testing" | "connected" | "failed">("testing");
  const [certRefreshing, setCertRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleStartEditing = () => {
    if (!project) return;
    setEditName(project.name);
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === project?.name) {
      setIsEditingName(false);
      return;
    }
    await updateProject({ id: projectId, name: trimmed });
    setIsEditingName(false);
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
  };

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

  // Auto-test Cloudflare on load
  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    (async () => {
      setCfStatus("testing");
      try {
        const res = await validateCf({
          apiToken: project.cloudflareApiToken,
          zoneId: project.cloudflareZoneId,
        });
        if (!cancelled) setCfStatus(res.connected ? "connected" : "failed");
      } catch {
        if (!cancelled) setCfStatus("failed");
      }
    })();
    return () => { cancelled = true; };
  }, [project?._id]);

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
        <Button variant="ghost" size="icon" render={<Link href="/projects" />}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                ref={nameInputRef}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") handleCancelEdit();
                }}
                className="h-8 rounded-md border border-border bg-transparent px-2 text-lg font-semibold text-foreground focus:border-foreground/20 focus:outline-none focus:ring-1 focus:ring-foreground/20"
              />
              <button
                onClick={handleSaveName}
                className="flex h-7 w-7 items-center justify-center rounded-md text-green-500 transition-colors hover:bg-green-500/10"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{project.name}</h2>
              <button
                onClick={handleStartEditing}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{project.domain}</p>
        </div>
        {project.isDefault && (
          <Badge variant="outline" size="sm">
            Default
          </Badge>
        )}
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cloudflare</CardTitle>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleTestCf}
                disabled={cfStatus === "testing"}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${cfStatus === "testing" ? "animate-spin" : ""}`} />
              </button>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {cfStatus === "connected" && <Badge variant="default" className="text-xs">Connected</Badge>}
            {cfStatus === "failed" && <Badge variant="destructive" className="text-xs">Failed</Badge>}
            {cfStatus === "idle" && <Badge variant="secondary" className="text-xs">Not tested</Badge>}
            {cfStatus === "testing" && <Badge variant="secondary" className="text-xs">Testing...</Badge>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Wildcard Cert</CardTitle>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleRefreshCert}
                disabled={certRefreshing}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${certRefreshing ? "animate-spin" : ""}`} />
              </button>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <Badge variant={project.wildcardCertId ? "default" : "secondary"} className="text-xs">
              {project.wildcardCertId ? `ID: ${project.wildcardCertId}` : "Not found"}
            </Badge>
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
        <h3 className="text-sm font-semibold">Deployments</h3>
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
                          className={`h-2 w-2 rounded-full ${getStatusColor(d.status)}`}
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
      <Card className="ring-destructive/30">
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
