"use client";

import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Database,
  ExternalLink,
  Loader2,
  Server,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ServiceType = "convex" | "postgres" | "spacetimedb";

interface DeploymentResult {
  id: string;
  adminKey: string;
  domainUrls: { backend: string; site: string; dashboard: string };
  portMappings: Record<string, number>;
}

const deploymentNameSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(63, "Name must be at most 63 characters")
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
      "Lowercase alphanumeric with hyphens only, cannot start or end with hyphen"
    ),
});

type DeploymentNameForm = z.infer<typeof deploymentNameSchema>;

const PROGRESS_STEPS = [
  "Allocating ports...",
  "Setting up DNS records...",
  "Configuring reverse proxies...",
  "Writing compose configuration...",
  "Starting containers...",
  "Waiting for health check...",
  "Generating credentials...",
  "Finalizing deployment...",
];

export default function NewDeploymentPage() {
  const [step, setStep] = useState(1);
  const [serviceType, setServiceType] = useState<ServiceType>("convex");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DeploymentResult | null>(null);
  const [progressIndex, setProgressIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const createDeployment = useAction(api.actions.createDeployment.createDeployment);

  const baseDomain = "devhomelab.org";

  const form = useForm<DeploymentNameForm>({
    resolver: zodResolver(deploymentNameSchema),
    defaultValues: { name: "" },
    mode: "onChange",
  });

  const name = form.watch("name");
  const isNameValid = form.formState.isValid && name.length >= 3;

  // Progress simulation during creation
  useEffect(() => {
    if (!creating) return;
    const interval = setInterval(() => {
      setProgressIndex((prev) =>
        prev < PROGRESS_STEPS.length - 1 ? prev + 1 : prev
      );
    }, 5000);
    return () => clearInterval(interval);
  }, [creating]);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    setProgressIndex(0);
    setStep(4);

    try {
      const res = await createDeployment({ name, serviceType });
      setResult(res as DeploymentResult);
      setStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deployment failed");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/deployments">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h3 className="text-sm font-medium">
            New Deployment
          </h3>
          <p className="text-xs text-muted-foreground">Step {step} of 5</p>
        </div>
      </div>

      {/* Step 1: Service Type */}
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Choose Service Type</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card
              className={`cursor-pointer transition-colors ${
                serviceType === "convex"
                  ? "border-primary ring-2 ring-primary/20"
                  : ""
              }`}
              onClick={() => setServiceType("convex")}
            >
              <CardHeader className="pb-3">
                <Database className="h-8 w-8 text-primary" />
                <CardTitle className="text-base">Convex</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Self-hosted Convex backend with dashboard
                </p>
              </CardContent>
            </Card>

            <Card className="cursor-not-allowed opacity-50">
              <CardHeader className="pb-3">
                <Server className="h-8 w-8 text-muted-foreground" />
                <CardTitle className="text-base">Postgres</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary" className="text-xs">
                  Coming Soon
                </Badge>
              </CardContent>
            </Card>

            <Card className="cursor-not-allowed opacity-50">
              <CardHeader className="pb-3">
                <Server className="h-8 w-8 text-muted-foreground" />
                <CardTitle className="text-base">SpaceTimeDB</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary" className="text-xs">
                  Coming Soon
                </Badge>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setStep(2)}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Configuration */}
      {step === 2 && (
        <div className="space-y-6">
          <h3 className="text-lg font-medium">Configure Deployment</h3>

          <div className="space-y-2">
            <Label htmlFor="name">Deployment Name</Label>
            <Input
              id="name"
              {...form.register("name", {
                onChange: (e) => {
                  const lower = e.target.value.toLowerCase();
                  form.setValue("name", lower, { shouldValidate: true });
                },
              })}
              placeholder="my-app"
              autoComplete="off"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          {isNameValid && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Subdomain Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Backend API</span>
                  <code className="text-xs">
                    {name}-convex-backend.{baseDomain}
                  </code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">HTTP Actions</span>
                  <code className="text-xs">
                    {name}-convex-actions.{baseDomain}
                  </code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Dashboard</span>
                  <code className="text-xs">
                    {name}-convex-dashboard.{baseDomain}
                  </code>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Port Assignment</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Ports will be automatically assigned from the available range
                (10210-10999).
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={() => setStep(3)} disabled={!isNameValid}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="space-y-6">
          <h3 className="text-lg font-medium">Review & Create</h3>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service Type</span>
                <Badge variant="outline">{serviceType}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subdomains</span>
                <span className="text-sm">3 records</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ports</span>
                <span className="text-sm">4 auto-assigned</span>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleCreate}>Create Deployment</Button>
          </div>
        </div>
      )}

      {/* Step 4: Progress */}
      {step === 4 && (
        <div className="space-y-6">
          <h3 className="text-lg font-medium">
            {error ? "Deployment Failed" : "Creating Deployment..."}
          </h3>

          {error ? (
            <Card className="border-destructive">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Error</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {error}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => router.push("/deployments")}
                  >
                    Back to Deployments
                  </Button>
                  <Button onClick={handleCreate}>Retry</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 space-y-3">
                {PROGRESS_STEPS.map((label, i) => (
                  <div key={label} className="flex items-center gap-3">
                    {i < progressIndex ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : i === progressIndex ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border" />
                    )}
                    <span
                      className={
                        i <= progressIndex
                          ? "text-sm"
                          : "text-sm text-muted-foreground"
                      }
                    >
                      {label}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Step 5: Success */}
      {step === 5 && result && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Check className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-medium">Deployment Created</h3>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Admin Key</CardTitle>
              <CardDescription>
                Save this key — it will not be shown again.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-xs break-all">
                  {result.adminKey}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(result.adminKey)}
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

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Domain URLs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(result.domainUrls).map(([role, url]) => (
                <div key={role} className="flex items-center justify-between">
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

          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href="/deployments">Go to Deployments</Link>
            </Button>
            <Button asChild>
              <a
                href={result.domainUrls.dashboard}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Dashboard
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
