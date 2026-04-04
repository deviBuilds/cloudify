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
import { useSort } from "@/lib/use-sort";
import { Plus, Container, ExternalLink, Search, ListFilter, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionsDropdown } from "@/components/deployments/actions-dropdown";
import { DeleteDialog } from "@/components/deployments/delete-dialog";
import { getStatusColor } from "@/lib/status";

export default function DeploymentsPage() {
  const deployments = useQuery(api.deployments.list);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: Id<"deployments">;
    name: string;
  } | null>(null);

  const filtered = deployments?.filter(
    (d) =>
      search === "" ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.serviceType.toLowerCase().includes(search.toLowerCase())
  );

  const { sorted, toggleSort, getSortDirection } = useSort(filtered);

  return (
    <div className="space-y-6">
      {/* Search + Actions Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search Deployments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-md border border-border bg-transparent pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground/20 focus:outline-none focus:ring-1 focus:ring-foreground/20"
          />
        </div>
        <Button variant="outline" size="icon" className="shrink-0">
          <ListFilter className="h-4 w-4" />
        </Button>
        <Button variant="outline" className="shrink-0" render={<Link href="/deployments/new" />}>
          Add New...
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>

      {sorted && sorted.length > 0 ? (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead sortable sortDirection={getSortDirection("name")} onSort={() => toggleSort("name")}>Name</TableHead>
                <TableHead sortable sortDirection={getSortDirection("serviceType")} onSort={() => toggleSort("serviceType")}>Type</TableHead>
                <TableHead sortable sortDirection={getSortDirection("status")} onSort={() => toggleSort("status")}>Status</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead sortable sortDirection={getSortDirection("_creationTime")} onSort={() => toggleSort("_creationTime")}>Created</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((d) => (
                <TableRow
                  key={d._id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/deployments/${d._id}`)}
                >
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" size="sm">
                      {d.serviceType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${getStatusColor(d.status)}`}
                      />
                      <span className="text-sm capitalize">{d.status}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {(d.domainUrls as Record<string, string> | undefined)
                      ?.dashboard ? (
                      <a
                        href={
                          (d.domainUrls as Record<string, string>).dashboard
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(
                          d.domainUrls as Record<string, string>
                        ).dashboard.replace("https://", "")}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(d._creationTime).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
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
        </Card>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border py-16 text-center">
          <Container className="h-8 w-8 text-muted-foreground/30" />
          <div>
            <p className="text-sm font-medium">No deployments yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create your first deployment to get started.
            </p>
          </div>
          <Button variant="outline" size="sm" render={<Link href="/deployments/new" />} className="mt-2">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Deployment
          </Button>
        </div>
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
