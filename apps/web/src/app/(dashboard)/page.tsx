"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Container, CircleCheck, CircleX, CirclePause } from "lucide-react";

export default function DashboardPage() {
  const deployments = useQuery(api.deployments.list);

  const total = deployments?.length ?? 0;
  const running =
    deployments?.filter((d) => d.status === "running").length ?? 0;
  const stopped =
    deployments?.filter((d) => d.status === "stopped").length ?? 0;
  const errors =
    deployments?.filter(
      (d) => d.status === "error" || d.status === "degraded"
    ).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
        <p className="text-muted-foreground">
          Deployment status at a glance
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Deployments"
          value={total}
          icon={<Container className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Running"
          value={running}
          icon={<CircleCheck className="h-4 w-4 text-green-500" />}
        />
        <StatCard
          title="Stopped"
          value={stopped}
          icon={<CirclePause className="h-4 w-4 text-yellow-500" />}
        />
        <StatCard
          title="Errors"
          value={errors}
          icon={<CircleX className="h-4 w-4 text-red-500" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Deployments</CardTitle>
          <CardDescription>
            {total === 0
              ? "No deployments yet. Create one to get started."
              : "Latest deployments and their status"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deployments && deployments.length > 0 ? (
            <div className="space-y-3">
              {deployments.slice(0, 5).map((d) => (
                <div
                  key={d._id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Container className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.serviceType}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No deployments found.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    running: "default",
    creating: "secondary",
    stopped: "outline",
    error: "destructive",
    degraded: "destructive",
  };

  return (
    <Badge variant={variants[status] ?? "secondary"}>
      {status}
    </Badge>
  );
}
