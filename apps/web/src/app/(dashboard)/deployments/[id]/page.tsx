"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useQuery, useAction } from "convex/react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSort } from "@/lib/use-sort";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Play,
  Square,
  RotateCcw,
  RefreshCw,
  Loader2,
  Cpu,
  MemoryStick,
} from "lucide-react";
import Link from "next/link";
import { DeleteDialog } from "@/components/deployments/delete-dialog";
import { CpuChart } from "@/components/metrics/cpu-chart";
import { MemoryChart } from "@/components/metrics/memory-chart";

interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
}

interface ContainerMetrics {
  id: string;
  name: string;
  cpuPercent: number;
  memUsage: number;
  memLimit: number;
}

export default function DeploymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const deploymentId = id as Id<"deployments">;
  const deployment = useQuery(api.deployments.get, { id: deploymentId });
  const dnsRecords = useQuery(api.dnsRecords.byDeployment, {
    deploymentId,
  });
  const credentials = useQuery(api.credentials.get, { deploymentId });

  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [metrics, setMetrics] = useState<ContainerMetrics[]>([]);
  const [logs, setLogs] = useState<string>("");
  const [selectedContainer, setSelectedContainer] = useState<string>("");
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [metricsLoaded, setMetricsLoaded] = useState(false);
  const [followMode, setFollowMode] = useState(false);
  const [logFilter, setLogFilter] = useState("");
  const eventSourceRef = useRef<EventSource | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const startAction = useAction(api.actions.lifecycleActions.start);
  const stopAction = useAction(api.actions.lifecycleActions.stop);
  const restartAction = useAction(api.actions.lifecycleActions.restart);

  const { sorted: sortedContainers, toggleSort: toggleContainerSort, getSortDirection: getContainerSortDir } = useSort(containers);
  const activeDnsRecords = dnsRecords?.filter((r) => !r.deletedAt);
  const { sorted: sortedDns, toggleSort: toggleDnsSort, getSortDirection: getDnsSortDir } = useSort(activeDnsRecords);

  const fetchContainers = useCallback(async () => {
    if (!deployment) return;
    try {
      const prefix = deployment.containerPrefix || deployment.name;
      const res = await fetch(
        `/api/proxy/infra/containers?prefix=${encodeURIComponent(prefix)}`
      );
      if (res.ok) {
        setContainers(await res.json());
      }
    } catch {
      // Infra agent may not be reachable
    }
  }, [deployment]);

  const fetchMetrics = useCallback(async () => {
    if (!deployment) return;
    try {
      const prefix = deployment.containerPrefix || deployment.name;
      const res = await fetch("/api/proxy/infra/metrics/containers");
      if (res.ok) {
        const all = (await res.json()) as ContainerMetrics[];
        setMetrics(
          all.filter((m) => m.name.startsWith(prefix))
        );
        setMetricsLoaded(true);
      }
    } catch {
      // Infra agent may not be reachable
    }
  }, [deployment]);

  const fetchLogs = useCallback(
    async (containerId: string) => {
      if (!containerId) return;
      try {
        const res = await fetch(
          `/api/proxy/infra/containers/${containerId}/logs?tail=200`
        );
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || "");
        }
      } catch {
        setLogs("Failed to fetch logs");
      }
    },
    []
  );

  useEffect(() => {
    fetchContainers();
  }, [fetchContainers]);

  useEffect(() => {
    if (containers.length > 0 && !selectedContainer) {
      const backend = containers.find((c) => c.name.includes("backend"));
      setSelectedContainer(backend?.id || containers[0].id);
    }
  }, [containers, selectedContainer]);

  useEffect(() => {
    if (activeTab !== "metrics") return;
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, [activeTab, fetchMetrics]);

  // Follow mode: SSE log streaming
  useEffect(() => {
    if (!followMode || !selectedContainer) return;

    const es = new EventSource(
      `/api/proxy/infra/containers/${selectedContainer}/logs/stream?tail=100`
    );
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const line = JSON.parse(event.data);
        setLogs((prev) => prev + line + "\n");
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
      } catch {
        // non-JSON data, append raw
        setLogs((prev) => prev + event.data + "\n");
      }
    };

    es.onerror = () => {
      // Reconnect is handled automatically by EventSource
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [followMode, selectedContainer]);

  // Stop follow when switching away from logs tab
  useEffect(() => {
    if (activeTab !== "logs" && followMode) {
      setFollowMode(false);
    }
  }, [activeTab, followMode]);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAction = async (
    actionName: string,
    fn: (args: { id: Id<"deployments"> }) => Promise<void>
  ) => {
    setActionLoading(actionName);
    try {
      await fn({ id: deploymentId });
    } catch (err) {
      console.error(`Failed to ${actionName}:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  if (!deployment) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const domainUrls = deployment.domainUrls as
    | Record<string, string>
    | undefined;
  const portMappings = deployment.portMappings as Record<string, number>;
  const adminKey = credentials?.find((c) => c.keyType === "admin_key");
  const isRunning = deployment.status === "running";
  const isStopped = deployment.status === "stopped";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" render={<Link href="/deployments" />}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">
              {deployment.name}
            </h2>
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  deployment.status === "running"
                    ? "bg-green-500"
                    : deployment.status === "error"
                      ? "bg-red-500"
                      : deployment.status === "degraded"
                        ? "bg-yellow-500"
                        : "bg-neutral-500"
                }`}
              />
              <span className="text-xs text-muted-foreground">{deployment.status}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" size="sm">
              {deployment.serviceType}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Created {new Date(deployment._creationTime).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {isStopped && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction("start", startAction)}
              disabled={!!actionLoading}
            >
              {actionLoading === "start" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Start
            </Button>
          )}
          {isRunning && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction("stop", stopAction)}
                disabled={!!actionLoading}
              >
                {actionLoading === "stop" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Square className="mr-2 h-4 w-4" />
                )}
                Stop
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction("restart", restartAction)}
                disabled={!!actionLoading}
              >
                {actionLoading === "restart" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                Restart
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="containers">Containers</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="domains">Domains</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Domain URLs */}
          {domainUrls && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Domain URLs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(domainUrls).map(([role, url]) => (
                  <div
                    key={role}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-muted-foreground capitalize">
                      {role}
                    </span>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      {url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Credentials */}
          {adminKey && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Credentials</CardTitle>
                <CardDescription>Admin key for this deployment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-xs">
                    {showKey ? adminKey.keyValue : "************************************"}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(adminKey.keyValue)}
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Port Mappings */}
          {portMappings && Object.keys(portMappings).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Port Mappings</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role</TableHead>
                      <TableHead>Port</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(portMappings).map(([role, port]) => (
                      <TableRow key={role}>
                        <TableCell className="capitalize">{role}</TableCell>
                        <TableCell>
                          <code>{port}</code>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Containers Tab */}
        <TabsContent value="containers" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={fetchContainers}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
          {sortedContainers && sortedContainers.length > 0 ? (
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead sortable sortDirection={getContainerSortDir("name")} onSort={() => toggleContainerSort("name")}>Name</TableHead>
                      <TableHead sortable sortDirection={getContainerSortDir("image")} onSort={() => toggleContainerSort("image")}>Image</TableHead>
                      <TableHead sortable sortDirection={getContainerSortDir("state")} onSort={() => toggleContainerSort("state")}>State</TableHead>
                      <TableHead sortable sortDirection={getContainerSortDir("status")} onSort={() => toggleContainerSort("status")}>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedContainers.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">
                          {c.name}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.image}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${c.state === "running" ? "bg-green-500" : "bg-neutral-500"}`}
                            />
                            <span className="text-sm">{c.state}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.status}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No containers found for this deployment.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <div className="flex items-center gap-3">
            <select
              className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              value={selectedContainer}
              onChange={(e) => {
                setSelectedContainer(e.target.value);
                setFollowMode(false);
                setLogs("");
              }}
            >
              {containers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="flex overflow-hidden rounded-md border border-border">
              <button
                onClick={() => {
                  setFollowMode(false);
                  fetchLogs(selectedContainer);
                }}
                className={`px-3 py-1.5 text-xs transition-colors ${!followMode ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Tail
              </button>
              <button
                onClick={() => {
                  setLogs("");
                  setFollowMode(true);
                }}
                className={`px-3 py-1.5 text-xs transition-colors ${followMode ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Follow
              </button>
            </div>
            {!followMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLogs(selectedContainer)}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            )}
            {followMode && (
              <Badge variant="default" size="sm" className="animate-pulse">
                Live
              </Badge>
            )}
            <div className="flex-1" />
            <input
              type="text"
              placeholder="Filter logs..."
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              className="h-8 w-48 rounded-md border border-border bg-transparent px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-foreground/20 focus:outline-none focus:ring-1 focus:ring-foreground/20"
            />
          </div>
          <Card>
            <CardContent className="pt-6">
              <pre className="max-h-[500px] overflow-auto rounded-md bg-card p-4 font-mono text-xs whitespace-pre-wrap ring-1 ring-foreground/10">
                {(() => {
                  const content = logs || (followMode ? "Connecting to log stream..." : "Select a mode and container to view logs.");
                  if (!logFilter) return content;
                  return content
                    .split("\n")
                    .filter((line) => line.toLowerCase().includes(logFilter.toLowerCase()))
                    .join("\n") || "No lines match filter.";
                })()}
                <div ref={logEndRef} />
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={fetchMetrics}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
          {!metricsLoaded ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <Skeleton className="h-4 w-32" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded" />
                        <div className="flex-1 space-y-1.5">
                          <div className="flex justify-between">
                            <Skeleton className="h-3 w-8" />
                            <Skeleton className="h-3 w-10" />
                          </div>
                          <Skeleton className="h-2 w-full rounded-full" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded" />
                        <div className="flex-1 space-y-1.5">
                          <div className="flex justify-between">
                            <Skeleton className="h-3 w-12" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                          <Skeleton className="h-2 w-full rounded-full" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {[...Array(2)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
                    <CardContent><Skeleton className="h-[180px] w-full" /></CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : metrics.length > 0 ? (
            <div className="space-y-4">
              {/* Summary gauges */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {metrics.map((m) => {
                  const memPercent =
                    m.memLimit > 0
                      ? Math.round((m.memUsage / m.memLimit) * 100)
                      : 0;
                  const memMB = Math.round(m.memUsage / 1024 / 1024);
                  const memLimitMB = Math.round(m.memLimit / 1024 / 1024);
                  return (
                    <Card key={m.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-mono">
                          {m.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Cpu className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <div className="flex justify-between text-xs">
                              <span>CPU</span>
                              <span>{m.cpuPercent.toFixed(1)}%</span>
                            </div>
                            <div className="mt-1 h-2 rounded-full bg-muted">
                              <div
                                className="h-2 rounded-full bg-primary"
                                style={{
                                  width: `${Math.min(m.cpuPercent, 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <MemoryStick className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <div className="flex justify-between text-xs">
                              <span>Memory</span>
                              <span>
                                {memMB} / {memLimitMB} MB ({memPercent}%)
                              </span>
                            </div>
                            <div className="mt-1 h-2 rounded-full bg-muted">
                              <div
                                className="h-2 rounded-full bg-primary"
                                style={{
                                  width: `${Math.min(memPercent, 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              {/* Trend charts per container */}
              {metrics.map((m) => (
                <div key={`charts-${m.id}`} className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground font-mono">{m.name}</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <CpuChart
                      title="CPU %"
                      currentValue={m.cpuPercent}
                      sourceId={m.id}
                    />
                    <MemoryChart
                      title="Memory"
                      usedBytes={m.memUsage}
                      limitBytes={m.memLimit}
                      sourceId={m.id}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No container metrics available.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Domains Tab */}
        <TabsContent value="domains" className="space-y-4">
          {sortedDns && sortedDns.length > 0 ? (
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead sortable sortDirection={getDnsSortDir("subdomain")} onSort={() => toggleDnsSort("subdomain")}>Subdomain</TableHead>
                      <TableHead sortable sortDirection={getDnsSortDir("fullDomain")} onSort={() => toggleDnsSort("fullDomain")}>Full Domain</TableHead>
                      <TableHead sortable sortDirection={getDnsSortDir("serviceRole")} onSort={() => toggleDnsSort("serviceRole")}>Role</TableHead>
                      <TableHead sortable sortDirection={getDnsSortDir("targetPort")} onSort={() => toggleDnsSort("targetPort")}>Port</TableHead>
                      <TableHead>WebSocket</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedDns.map((r) => (
                        <TableRow key={r._id}>
                          <TableCell className="font-mono text-xs">
                            {r.subdomain}
                          </TableCell>
                          <TableCell className="text-xs">
                            {r.fullDomain}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{r.serviceRole}</Badge>
                          </TableCell>
                          <TableCell>
                            <code>{r.targetPort}</code>
                          </TableCell>
                          <TableCell>
                            {r.websocket ? (
                              <Badge variant="default">Yes</Badge>
                            ) : (
                              <span className="text-muted-foreground">No</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No DNS records found for this deployment.
              </CardContent>
            </Card>
          )}
        </TabsContent>
        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Configuration</CardTitle>
              <CardDescription>Read-only deployment configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Name</TableCell>
                    <TableCell>{deployment.name}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Service Type</TableCell>
                    <TableCell>{deployment.serviceType}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Container Prefix</TableCell>
                    <TableCell className="font-mono text-sm">
                      {deployment.containerPrefix}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Status</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            deployment.status === "running"
                              ? "bg-green-500"
                              : deployment.status === "error"
                                ? "bg-red-500"
                                : "bg-neutral-500"
                          }`}
                        />
                        <span className="text-sm">{deployment.status}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Created</TableCell>
                    <TableCell>
                      {new Date(deployment._creationTime).toLocaleString()}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Compose Directory</TableCell>
                    <TableCell className="font-mono text-sm">
                      /opt/cloudify/deployments/{deployment.name}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="ring-destructive/30">
            <CardHeader>
              <CardTitle className="text-sm text-destructive">
                Danger Zone
              </CardTitle>
              <CardDescription>
                These actions are irreversible. Proceed with caution.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3">
              {isRunning && (
                <Button
                  variant="outline"
                  onClick={() => handleAction("stop", stopAction)}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "stop" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Square className="mr-2 h-4 w-4" />
                  )}
                  Stop Deployment
                </Button>
              )}
              <Button
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                Delete Deployment
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        deploymentId={deploymentId}
        deploymentName={deployment.name}
      />
    </div>
  );
}
