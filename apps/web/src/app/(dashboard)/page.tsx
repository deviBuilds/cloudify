"use client";

import { useState } from "react";
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
import {
  Plus,
  Search,
  MoreHorizontal,
  Container,
  ListFilter,
  LayoutGrid,
  StretchHorizontal,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { getStatusColor } from "@/lib/status";

type ViewMode = "grid" | "list";

export default function DashboardPage() {
  const deployments = useQuery(api.deployments.list);
  const projects = useQuery(api.projects.list);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const total = deployments?.length ?? 0;
  const running =
    deployments?.filter((d) => d.status === "running").length ?? 0;
  const stopped =
    deployments?.filter((d) => d.status === "stopped").length ?? 0;
  const errors =
    deployments?.filter(
      (d) => d.status === "error" || d.status === "degraded"
    ).length ?? 0;

  const filteredProjects = projects?.filter(
    (p) =>
      search === "" ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.domain.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Search + Actions Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search Projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-md border border-border bg-transparent pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground/20 focus:outline-none focus:ring-1 focus:ring-foreground/20"
          />
        </div>
        <Button variant="outline" size="icon" className="shrink-0">
          <ListFilter className="h-4 w-4" />
        </Button>
        <div className="flex shrink-0 overflow-hidden rounded-md border border-border">
          <button
            onClick={() => setViewMode("grid")}
            className={`flex h-9 w-9 items-center justify-center transition-colors ${
              viewMode === "grid"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`flex h-9 w-9 items-center justify-center transition-colors ${
              viewMode === "list"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <StretchHorizontal className="h-4 w-4" />
          </button>
        </div>
        <Button
          variant="outline"
          className="shrink-0"
          render={<Link href="/projects/new" />}
        >
          Add New...
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        {/* Left Column: Usage */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Usage</CardTitle>
              <Badge variant="outline" size="sm">
                Live
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Projects", value: projects?.length ?? 0 },
                { label: "Running Deployments", value: running },
                { label: "Stopped", value: stopped },
                { label: "Errors", value: errors },
                { label: "Total Deployments", value: total },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="tabular-nums font-medium">{row.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Projects */}
        <div className="space-y-4">
          <span className="text-sm font-medium text-muted-foreground">
            Projects
          </span>

          {filteredProjects && filteredProjects.length > 0 ? (
            viewMode === "grid" ? (
              <ul className="m-0 grid grid-cols-[repeat(auto-fill,minmax(330px,1fr))] gap-4 p-0">
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project._id}
                    project={project}
                    deployments={deployments}
                  />
                ))}
              </ul>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                {filteredProjects.map((project, i) => {
                  const projectDeployments =
                    deployments?.filter(
                      (d) => d.projectId === project._id
                    ) ?? [];
                  const latest = projectDeployments[0];
                  const latestDomains = latest?.domainUrls as
                    | Record<string, string>
                    | undefined;

                  return (
                    <Link
                      key={project._id}
                      href={`/projects/${project._id}`}
                      className={`flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent/50 ${
                        i > 0 ? "border-t border-border" : ""
                      }`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-pink-500">
                        <span className="text-[10px] font-bold text-white">
                          {project.name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium text-foreground">
                          {project.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {latestDomains?.dashboard
                            ? latestDomains.dashboard.replace("https://", "")
                            : project.domain}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1a1a1a] px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-foreground/10">
                        <Container className="h-3 w-3" />
                        {projectDeployments.length}
                      </span>
                      {latest && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${getStatusColor(latest.status)}`}
                          />
                          <span className="capitalize">{latest.status}</span>
                          <span>·</span>
                          <span>
                            {new Date(
                              latest._creationTime
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      )}
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          project.wildcardCertId
                            ? "bg-green-500"
                            : "bg-yellow-500"
                        }`}
                      />
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </Link>
                  );
                })}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border py-16 text-center">
              <Container className="h-8 w-8 text-muted-foreground/30" />
              <div>
                <p className="text-sm font-medium">No projects yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create a project to start deploying services.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                render={<Link href="/projects/new" />}
                className="mt-2"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New Project
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  deployments,
}: {
  project: { _id: string; name: string; domain: string; wildcardCertId?: string | null; isDefault?: boolean };
  deployments: Array<{ _id: string; projectId?: string; name: string; status: string; serviceType: string; _creationTime: number; domainUrls?: unknown }> | undefined;
}) {
  const projectDeployments =
    deployments?.filter((d) => d.projectId === project._id) ?? [];
  const latest = projectDeployments[0];
  const latestDomains = latest?.domainUrls as
    | Record<string, string>
    | undefined;

  return (
    <li className="list-none">
      <Link href={`/projects/${project._id}`} className="block">
        <div className="relative flex flex-col gap-3 rounded-lg border border-border p-4 transition-colors hover:border-[#444]">
          {/* Row 1: Avatar + Name + Domain + Menu */}
          <div className="flex flex-row items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-pink-500">
              <span className="text-xs font-bold text-white">
                {project.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-medium text-foreground">
                {project.name}
              </span>
              <span className="truncate text-sm text-muted-foreground">
                {latestDomains?.dashboard
                  ? latestDomains.dashboard.replace("https://", "")
                  : project.domain}
              </span>
            </div>
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                project.wildcardCertId
                  ? "bg-green-500"
                  : "bg-yellow-500"
              }`}
            />
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          {/* Row 2: Deployment count pill */}
          <div className="flex h-5 items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1a1a1a] px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-foreground/10">
              <Container className="h-3 w-3" />
              {projectDeployments.length} deployment
              {projectDeployments.length !== 1 ? "s" : ""}
            </span>
            {project.isDefault && (
              <Badge variant="outline" size="sm">
                Default
              </Badge>
            )}
          </div>

          {/* Row 3: Latest deployment info */}
          {latest ? (
            <div className="flex flex-col gap-0.5">
              <span className="truncate text-sm font-medium text-foreground">
                {latest.name}
              </span>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${getStatusColor(latest.status)}`}
                />
                <span className="capitalize">{latest.status}</span>
                <span>·</span>
                <span>
                  {new Date(latest._creationTime).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric" }
                  )}
                </span>
              </div>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">
              No deployments yet
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}
