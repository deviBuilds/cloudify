"use client";

import { Badge } from "@/components/ui/badge";
import { Container, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { getStatusColor } from "@/lib/status";

export interface ProjectCardProps {
  project: {
    _id: string;
    name: string;
    domain: string;
    wildcardCertId?: string | null;
    isDefault?: boolean;
  };
  deployments:
    | Array<{
        _id: string;
        projectId?: string;
        name: string;
        status: string;
        serviceType: string;
        _creationTime: number;
        domainUrls?: unknown;
      }>
    | undefined;
  showCertBadge?: boolean;
}

export function ProjectCard({
  project,
  deployments,
  showCertBadge = false,
}: ProjectCardProps) {
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
                project.wildcardCertId ? "bg-green-500" : "bg-yellow-500"
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
            {showCertBadge && !project.wildcardCertId && (
              <Badge variant="warning" size="sm">
                No cert
              </Badge>
            )}
          </div>

          {/* Row 3: Latest deployment info (fixed height for consistency) */}
          <div className="flex h-[40px] flex-col justify-center gap-0.5">
            {latest ? (
              <>
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
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                No deployments yet
              </span>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}
