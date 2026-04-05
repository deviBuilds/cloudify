"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { InfrastructureStatus } from "@/components/settings/infrastructure-status";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Trash2,
  Play,
  Square,
  RotateCcw,
  Globe,
  ScrollText,
  ChevronDown,
} from "lucide-react";

const actionIcons: Record<string, typeof Plus> = {
  create: Plus,
  delete: Trash2,
  start: Play,
  stop: Square,
  restart: RotateCcw,
  dns_create: Globe,
  dns_delete: Globe,
};

const actionColors: Record<string, string> = {
  create: "bg-green-500/10 text-green-500",
  delete: "bg-red-500/10 text-red-500",
  start: "bg-blue-500/10 text-blue-500",
  stop: "bg-yellow-500/10 text-yellow-500",
  restart: "bg-orange-500/10 text-orange-500",
  dns_create: "bg-cyan-500/10 text-cyan-500",
  dns_delete: "bg-cyan-500/10 text-cyan-500",
};

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function SettingsPage() {
  const [auditLimit, setAuditLimit] = useState(25);
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const auditLog = useQuery(api.auditLog.list, { limit: auditLimit });

  const filteredLog = actionFilter
    ? auditLog?.filter((e) => e.action === actionFilter)
    : auditLog;

  const uniqueActions = auditLog
    ? [...new Set(auditLog.map((e) => e.action))].sort()
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium">Settings</h3>
        <p className="text-xs text-muted-foreground">
          Platform configuration and infrastructure status
        </p>
      </div>
      <InfrastructureStatus />

      {/* Audit Log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Audit Log</CardTitle>
          </div>
          {uniqueActions.length > 0 && (
            <div className="flex items-center gap-2">
              {actionFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActionFilter(null)}
                  className="text-xs text-muted-foreground"
                >
                  Clear filter
                </Button>
              )}
              <select
                value={actionFilter ?? ""}
                onChange={(e) =>
                  setActionFilter(e.target.value || null)
                }
                className="h-8 rounded-md border border-border bg-transparent px-2 text-xs text-foreground"
              >
                <option value="">All actions</option>
                {uniqueActions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!auditLog ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : filteredLog && filteredLog.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Time</TableHead>
                    <TableHead className="w-[120px]">Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLog.map((entry) => {
                    const Icon = actionIcons[entry.action] ?? ScrollText;
                    const colorClass = actionColors[entry.action] ?? "bg-muted text-muted-foreground";
                    return (
                      <TableRow key={entry._id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {timeAgo(entry._creationTime)}
                        </TableCell>
                        <TableCell>
                          <div className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
                            <Icon className="h-3 w-3" />
                            {entry.action}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="text-muted-foreground">{entry.resourceType}</span>
                          {entry.resourceId && (
                            <span className="ml-1.5 font-mono text-xs text-muted-foreground/60">
                              {entry.resourceId.slice(0, 12)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-48 truncate">
                          {entry.details
                            ? typeof entry.details === "string"
                              ? entry.details
                              : JSON.stringify(entry.details)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {auditLog.length === auditLimit && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAuditLimit((l) => l + 25)}
                  >
                    <ChevronDown className="mr-1.5 h-3.5 w-3.5" />
                    Load More
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {actionFilter ? "No entries match this filter." : "No audit log entries yet."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
