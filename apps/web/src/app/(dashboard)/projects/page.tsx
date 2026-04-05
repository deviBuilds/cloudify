"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  FolderKanban,
  Plus,
  Search,
  MoreHorizontal,
  Container,
  ListFilter,
  LayoutGrid,
  StretchHorizontal,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { getStatusColor } from "@/lib/status";
import { ProjectCard } from "@/components/projects/project-card";

export default function ProjectsPage() {
  const projects = useQuery(api.projects.list);
  const deployments = useQuery(api.deployments.list);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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
            className={`flex h-9 w-9 items-center justify-center transition-colors ${viewMode === "grid" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`flex h-9 w-9 items-center justify-center transition-colors ${viewMode === "list" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <StretchHorizontal className="h-4 w-4" />
          </button>
        </div>
        <Button variant="outline" className="shrink-0" render={<Link href="/projects/new" />}>
          Add New...
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>

      {/* Projects Grid/List */}
      {filteredProjects && filteredProjects.length > 0 ? (
        viewMode === "grid" ? (
          <ul className="m-0 grid grid-cols-[repeat(auto-fill,minmax(330px,1fr))] gap-4 p-0">
            {filteredProjects.map((p) => (
              <ProjectCard
                key={p._id}
                project={p}
                deployments={deployments}
                showCertBadge
              />
            ))}
          </ul>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            {filteredProjects.map((p, i) => {
              const projectDeployments =
                deployments?.filter((d) => d.projectId === p._id) ?? [];
              const latest = projectDeployments[0];
              const latestDomains = latest?.domainUrls as
                | Record<string, string>
                | undefined;

              return (
                <Link
                  key={p._id}
                  href={`/projects/${p._id}`}
                  className={`flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent/50 ${
                    i > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-pink-500">
                    <span className="text-[10px] font-bold text-white">
                      {p.name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-foreground">
                      {p.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {latestDomains?.dashboard
                        ? latestDomains.dashboard.replace("https://", "")
                        : p.domain}
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
                      p.wildcardCertId ? "bg-green-500" : "bg-yellow-500"
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
          <FolderKanban className="h-8 w-8 text-muted-foreground/30" />
          <div>
            <p className="text-sm font-medium">No projects yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create a project to manage deployments under a domain.
            </p>
          </div>
          <Button variant="outline" size="sm" render={<Link href="/projects/new" />} className="mt-2">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Project
          </Button>
        </div>
      )}
    </div>
  );
}
