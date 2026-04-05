"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { useSort } from "@/lib/use-sort";
import { Plus, Container, ExternalLink, Search, ListFilter, ChevronDown, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionsDropdown } from "@/components/deployments/actions-dropdown";
import { DeleteDialog } from "@/components/deployments/delete-dialog";
import { getStatusColor, statusMap } from "@/lib/status";

const SERVICE_TYPES = ["convex", "postgres", "spacetimedb"] as const;

export default function DeploymentsPage() {
  const deployments = useQuery(api.deployments.list);
  const projects = useQuery(api.projects.list);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: Id<"deployments">;
    name: string;
  } | null>(null);

  // Filter state
  const [filterProjects, setFilterProjects] = useState<Set<string>>(new Set());
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set());
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set());

  const activeFilterCount =
    filterProjects.size + filterStatuses.size + filterTypes.size;

  // Project lookup map
  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    projects?.forEach((p) => map.set(p._id, p.name));
    return map;
  }, [projects]);

  const toggleFilter = (
    set: Set<string>,
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    value: string
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const clearFilters = () => {
    setFilterProjects(new Set());
    setFilterStatuses(new Set());
    setFilterTypes(new Set());
  };

  // Enrich deployments with projectName for sorting
  const enriched = useMemo(() => {
    return deployments?.map((d) => ({
      ...d,
      projectName: (d.projectId && projectMap.get(d.projectId)) ?? "",
    }));
  }, [deployments, projectMap]);

  const filtered = enriched?.filter((d) => {
    // Search filter
    if (
      search &&
      !d.name.toLowerCase().includes(search.toLowerCase()) &&
      !d.serviceType.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    // Project filter
    if (filterProjects.size > 0 && (!d.projectId || !filterProjects.has(d.projectId)))
      return false;
    // Status filter
    if (filterStatuses.size > 0 && !filterStatuses.has(d.status))
      return false;
    // Type filter
    if (filterTypes.size > 0 && !filterTypes.has(d.serviceType))
      return false;
    return true;
  });

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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="relative shrink-0">
              <ListFilter className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-[10px] font-medium text-background">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Project</DropdownMenuLabel>
              {projects?.map((p) => (
                <DropdownMenuCheckboxItem
                  key={p._id}
                  checked={filterProjects.has(p._id)}
                  onClick={() => toggleFilter(filterProjects, setFilterProjects, p._id)}
                >
                  {p.name}
                </DropdownMenuCheckboxItem>
              ))}
              {(!projects || projects.length === 0) && (
                <div className="px-2 py-1 text-xs text-muted-foreground">No projects</div>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              {Object.entries(statusMap).map(([key, { label, color }]) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={filterStatuses.has(key)}
                  onClick={() => toggleFilter(filterStatuses, setFilterStatuses, key)}
                >
                  <span className={`h-2 w-2 rounded-full ${color}`} />
                  {label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Type</DropdownMenuLabel>
              {SERVICE_TYPES.map((type) => (
                <DropdownMenuCheckboxItem
                  key={type}
                  checked={filterTypes.has(type)}
                  onClick={() => toggleFilter(filterTypes, setFilterTypes, type)}
                >
                  {type}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" className="shrink-0" render={<Link href="/deployments/new" />}>
          Add New...
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>

      {/* Active filter pills */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {Array.from(filterProjects).map((id) => (
            <Badge key={id} variant="secondary" size="sm" className="gap-1">
              {projectMap.get(id) ?? "Unknown"}
              <button onClick={() => toggleFilter(filterProjects, setFilterProjects, id)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {Array.from(filterStatuses).map((s) => (
            <Badge key={s} variant="secondary" size="sm" className="gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${getStatusColor(s)}`} />
              {statusMap[s]?.label ?? s}
              <button onClick={() => toggleFilter(filterStatuses, setFilterStatuses, s)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {Array.from(filterTypes).map((t) => (
            <Badge key={t} variant="secondary" size="sm" className="gap-1">
              {t}
              <button onClick={() => toggleFilter(filterTypes, setFilterTypes, t)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <button
            onClick={clearFilters}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      )}

      {sorted && sorted.length > 0 ? (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead sortable sortDirection={getSortDirection("name")} onSort={() => toggleSort("name")}>Name</TableHead>
                <TableHead sortable sortDirection={getSortDirection("projectName")} onSort={() => toggleSort("projectName")}>Project</TableHead>
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
                    {d.projectId && projectMap.get(d.projectId) ? (
                      <Link
                        href={`/projects/${d.projectId}`}
                        className="text-sm text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {projectMap.get(d.projectId)}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
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
