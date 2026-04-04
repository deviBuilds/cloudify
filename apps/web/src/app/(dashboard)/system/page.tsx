"use client";

import { useEffect, useState, useCallback } from "react";
import { GaugeCard } from "@/components/metrics/gauge-card";
import { StatCard } from "@/components/metrics/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Cpu, HardDrive, MemoryStick, Clock, Container } from "lucide-react";

interface SystemMetrics {
  cpu: { usage: number; cores: number };
  memory: { total: number; used: number; free: number; usagePercent: number };
  disk: { total: number; used: number; free: number; usagePercent: number };
  uptime: number;
  loadAvg: number[];
}

interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  cpuPercent: number;
  memUsage: number;
  memLimit: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export default function SystemPage() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [sysRes, containerRes] = await Promise.all([
        fetch("/api/proxy/metrics/system"),
        fetch("/api/proxy/metrics/containers"),
      ]);

      if (sysRes.ok) {
        setMetrics(await sysRes.json());
      }
      if (containerRes.ok) {
        setContainers(await containerRes.json());
      }
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch metrics"
      );
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium">System</h3>
        <p className="text-xs text-muted-foreground">
          Host metrics and Docker containers
        </p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              Failed to connect to infra agent: {error}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Gauges */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics ? (
          <>
            <GaugeCard
              title="CPU Usage"
              value={metrics.cpu.usage}
              icon={<Cpu className="h-4 w-4 text-muted-foreground" />}
            />
            <GaugeCard
              title="Memory"
              value={metrics.memory.usagePercent}
              icon={
                <MemoryStick className="h-4 w-4 text-muted-foreground" />
              }
            />
            <GaugeCard
              title="Disk"
              value={metrics.disk.usagePercent}
              icon={
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              }
            />
            <StatCard
              title="Uptime"
              value={formatUptime(metrics.uptime)}
              subtitle={`${metrics.cpu.cores} cores`}
              icon={<Clock className="h-4 w-4 text-muted-foreground" />}
            />
          </>
        ) : (
          <>
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-24 w-24 rounded-full mx-auto" />
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>

      {/* Memory & Disk details */}
      {metrics && (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            title="Memory"
            value={`${formatBytes(metrics.memory.used)} / ${formatBytes(metrics.memory.total)}`}
            subtitle={`${formatBytes(metrics.memory.free)} free`}
          />
          <StatCard
            title="Disk"
            value={`${formatBytes(metrics.disk.used)} / ${formatBytes(metrics.disk.total)}`}
            subtitle={`${formatBytes(metrics.disk.free)} free`}
          />
        </div>
      )}

      {/* Docker Containers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Container className="h-5 w-5" />
            Docker Containers
          </CardTitle>
          <CardDescription>
            All containers on the host ({containers.length} total)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {containers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>CPU</TableHead>
                  <TableHead>Memory</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {containers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-sm">
                      {c.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-48 truncate">
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
                    <TableCell className="text-sm">
                      {c.state === "running"
                        ? `${c.cpuPercent.toFixed(1)}%`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.state === "running" && c.memLimit > 0
                        ? `${formatBytes(c.memUsage)} / ${formatBytes(c.memLimit)}`
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {error
                ? "Docker not available"
                : "No containers found"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
