"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, FolderKanban, RefreshCw } from "lucide-react";

interface InfraStatus {
  npm: { connected: boolean };
  serverIp: string;
}

export function InfrastructureStatus() {
  const [status, setStatus] = useState<InfraStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/proxy/infra/status");
      if (res.ok) {
        setStatus(await res.json());
        setError(null);
      } else {
        setError("Failed to fetch infrastructure status");
      }
    } catch {
      setError("Failed to connect to infra agent");
    }
  }, []);

  const handleTest = async () => {
    setTesting(true);
    await fetchStatus();
    setTesting(false);
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (error && !status) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Infrastructure Status</h3>
          <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${testing ? "animate-spin" : ""}`} />
            Test Connectivity
          </Button>
        </div>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const projects = useQuery(api.projects.list);
  const projectCount = projects?.length ?? 0;
  const certsConfigured = projects?.filter((p) => p.wildcardCertId).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Infrastructure Status</h3>
        <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${testing ? "animate-spin" : ""}`} />
          Test
        </Button>
      </div>

      {status ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Nginx Proxy Manager</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Badge variant={status.npm.connected ? "default" : "destructive"}>
                {status.npm.connected ? "Connected" : "Disconnected"}
              </Badge>
              <p className="text-xs text-muted-foreground mt-2">
                Reverse proxy &amp; SSL termination
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Projects</CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{projectCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {certsConfigured} with wildcard cert
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Server IP</CardTitle>
            </CardHeader>
            <CardContent>
              <code className="text-sm">{status.serverIp}</code>
              <p className="text-xs text-muted-foreground mt-2">
                Host address for DNS records
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-3 w-32 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
