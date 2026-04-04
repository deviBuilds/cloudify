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
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Container } from "lucide-react";

export default function DeploymentsPage() {
  const deployments = useQuery(api.deployments.list);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Deployments
          </h2>
          <p className="text-muted-foreground">
            Manage your service deployments
          </p>
        </div>
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" />
          New Deployment
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Deployments</CardTitle>
          <CardDescription>
            Real-time status of all managed deployments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deployments && deployments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deployments.map((d) => (
                  <TableRow key={d._id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{d.serviceType}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          d.status === "running"
                            ? "default"
                            : d.status === "error"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(d._creationTime).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Container className="h-12 w-12 text-muted-foreground/50" />
              <div>
                <p className="font-medium">No deployments yet</p>
                <p className="text-sm text-muted-foreground">
                  Create your first deployment to get started
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
