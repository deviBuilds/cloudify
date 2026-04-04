"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderKanban, Plus } from "lucide-react";
import Link from "next/link";

export default function ProjectsPage() {
  const projects = useQuery(api.projects.list);
  const deployments = useQuery(api.deployments.list);

  function deploymentCount(projectId: string) {
    return deployments?.filter((d) => d.projectId === projectId).length ?? 0;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Projects</h3>
        <Button variant="outline" size="sm" asChild>
          <Link href="/projects/new">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Project
          </Link>
        </Button>
      </div>

      {projects && projects.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p._id} href={`/projects/${p._id}`} className="block">
              <Card className="transition-colors hover:bg-accent/50">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.domain}</p>
                    </div>
                    <span
                      className={`mt-1 h-2 w-2 rounded-full ${
                        p.wildcardCertId ? "bg-green-500" : "bg-yellow-500"
                      }`}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {deploymentCount(p._id)} deployment{deploymentCount(p._id) !== 1 ? "s" : ""}
                    </Badge>
                    {p.isDefault && (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        Default
                      </Badge>
                    )}
                    {!p.wildcardCertId && (
                      <Badge variant="outline" className="text-[10px] font-normal text-yellow-500">
                        No cert
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <FolderKanban className="h-8 w-8 text-muted-foreground/30" />
            <div>
              <p className="text-sm font-medium">No projects yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create a project to manage deployments under a domain.
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
  );
}
