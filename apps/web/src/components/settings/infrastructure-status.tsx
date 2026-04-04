"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, Shield, FileCheck, Database, RefreshCw } from "lucide-react";

interface InfraStatus {
  cloudflare: { connected: boolean };
  npm: { connected: boolean };
  wildcardCert: { found: boolean; id: number | null; domain: string };
  dnsRecords: { total: number };
  baseDomain: string;
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
          <h3 className="text-lg font-medium">Infrastructure Status</h3>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Infrastructure Status</h3>
        <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${testing ? "animate-spin" : ""}`} />
          Test Connectivity
        </Button>
      </div>

      {status ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Cloudflare</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Badge variant={status.cloudflare.connected ? "default" : "destructive"}>
                {status.cloudflare.connected ? "Connected" : "Disconnected"}
              </Badge>
              <p className="text-xs text-muted-foreground mt-2">
                DNS provider for {status.baseDomain}
              </p>
            </CardContent>
          </Card>

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
              <CardTitle className="text-sm font-medium">Wildcard Certificate</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Badge variant={status.wildcardCert.found ? "default" : "secondary"}>
                {status.wildcardCert.found
                  ? `Found (ID: ${status.wildcardCert.id})`
                  : "Not Found"}
              </Badge>
              <p className="text-xs text-muted-foreground mt-2">
                {status.wildcardCert.domain}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">DNS Records</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{status.dnsRecords.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Managed records in Cloudflare
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
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
