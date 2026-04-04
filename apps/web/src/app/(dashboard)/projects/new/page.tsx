"use client";

import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
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
  Loader2,
  AlertCircle,
  Globe,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NewProjectPage() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [cfStatus, setCfStatus] = useState<"idle" | "testing" | "connected" | "failed">("idle");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    projectId: string;
    certFound: boolean;
    dnsCreated: boolean;
  } | null>(null);
  const router = useRouter();

  const createProject = useMutation(api.projects.create);
  const validateCf = useAction(api.actions.projectActions.validateCloudflare);
  const ensureDns = useAction(api.actions.projectActions.ensureServerDnsRecord);
  const discoverCert = useAction(api.actions.projectActions.discoverWildcardCert);

  const isStep1Valid = name.length >= 2 && domain.length >= 4 && domain.includes(".");
  const isStep2Valid = apiToken.length > 10 && zoneId.length > 10 && cfStatus === "connected";

  const handleTestConnection = async () => {
    setCfStatus("testing");
    try {
      const res = await validateCf({ apiToken, zoneId });
      setCfStatus(res.connected ? "connected" : "failed");
    } catch {
      setCfStatus("failed");
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    setStep(3);

    try {
      const projectId = await createProject({
        name,
        domain,
        cloudflareApiToken: apiToken,
        cloudflareZoneId: zoneId,
        scheme: "https",
      });

      // Auto-add server IP DNS record
      let dnsCreated = false;
      try {
        const dnsResult = await ensureDns({ projectId });
        dnsCreated = dnsResult.created;
      } catch {
        // Non-fatal
      }

      // Discover wildcard cert
      let certFound = false;
      try {
        const certResult = await discoverCert({ projectId });
        certFound = certResult.found;
      } catch {
        // Non-fatal
      }

      setResult({ projectId, certFound, dnsCreated });
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h3 className="text-sm font-medium">New Project</h3>
          <p className="text-xs text-muted-foreground">Step {step} of 4</p>
        </div>
      </div>

      {/* Step 1: Domain & Name */}
      {step === 1 && (
        <div className="space-y-6">
          <h3 className="text-lg font-medium">Domain & Name</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Project"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value.toLowerCase())}
                placeholder="example.com"
              />
              <p className="text-xs text-muted-foreground">
                Deployments will get subdomains under this domain (e.g., app-convex-backend.{domain || "example.com"})
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setStep(2)} disabled={!isStep1Valid}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Cloudflare Credentials */}
      {step === 2 && (
        <div className="space-y-6">
          <h3 className="text-lg font-medium">Cloudflare Credentials</h3>
          <p className="text-sm text-muted-foreground">
            Provide a Cloudflare API token with DNS edit permissions for {domain}.
          </p>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiToken">API Token</Label>
              <Input
                id="apiToken"
                type="password"
                value={apiToken}
                onChange={(e) => { setApiToken(e.target.value); setCfStatus("idle"); }}
                placeholder="Cloudflare API token"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zoneId">Zone ID</Label>
              <Input
                id="zoneId"
                value={zoneId}
                onChange={(e) => { setZoneId(e.target.value); setCfStatus("idle"); }}
                placeholder="Cloudflare zone ID"
              />
              <p className="text-xs text-muted-foreground">
                Found on the domain overview page in Cloudflare dashboard.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={!apiToken || !zoneId || cfStatus === "testing"}
            >
              {cfStatus === "testing" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Shield className="mr-2 h-4 w-4" />
              )}
              Test Connection
            </Button>
            {cfStatus === "connected" && (
              <Badge variant="default" className="text-xs">
                <Check className="mr-1 h-3 w-3" /> Connected
              </Badge>
            )}
            {cfStatus === "failed" && (
              <Badge variant="destructive" className="text-xs">
                <AlertCircle className="mr-1 h-3 w-3" /> Failed
              </Badge>
            )}
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleCreate} disabled={!isStep2Valid}>
              Create Project
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Creating */}
      {step === 3 && (
        <div className="space-y-6">
          <h3 className="text-lg font-medium">
            {error ? "Creation Failed" : "Creating Project..."}
          </h3>
          {error ? (
            <Card className="border-destructive">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Error</p>
                    <p className="text-sm text-muted-foreground mt-1">{error}</p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => { setStep(2); setError(null); }}>
                  Back
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center gap-3 py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Setting up project, checking DNS and certificates...
                </span>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Step 4: Done */}
      {step === 4 && result && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Check className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-medium">Project Created</h3>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Domain</span>
                <span className="text-sm font-medium">{domain}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Cloudflare</span>
                <Badge variant="default" className="text-xs">Connected</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Server DNS</span>
                <Badge variant={result.dnsCreated ? "default" : "secondary"} className="text-xs">
                  {result.dnsCreated ? "A record created" : "Already exists"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Wildcard Certificate</span>
                {result.certFound ? (
                  <Badge variant="default" className="text-xs">Found</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-yellow-500">
                    Not found
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {!result.certFound && (
            <Card className="border-yellow-500/30">
              <CardContent className="pt-6">
                <p className="text-sm text-yellow-500">
                  No wildcard certificate found for *.{domain}. You need to create one
                  in Nginx Proxy Manager (SSL Certificates → Add Let&apos;s Encrypt → DNS Challenge)
                  before deploying to this domain.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href="/projects">Go to Projects</Link>
            </Button>
            <Button asChild>
              <Link href="/deployments/new">Create Deployment</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
