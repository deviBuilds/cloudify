"use node";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";

// Subdomain patterns per service type
const SUBDOMAIN_ENTRIES: Record<
  string,
  { suffix: string; role: string; portKey: string; websocket: boolean }[]
> = {
  convex: [
    { suffix: "-convex-backend", role: "backend", portKey: "backend", websocket: true },
    { suffix: "-convex-actions", role: "site", portKey: "site", websocket: false },
    { suffix: "-convex-dashboard", role: "dashboard", portKey: "dashboard", websocket: false },
  ],
};

async function infraFetch(method: string, path: string, body?: unknown) {
  const url = process.env.INFRA_AGENT_URL;
  const secret = process.env.INFRA_AGENT_SECRET;
  if (!url || !secret) {
    throw new Error("INFRA_AGENT_URL and INFRA_AGENT_SECRET must be configured");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${secret}`,
  };
  const options: RequestInit = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${url}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Infra agent error ${res.status}: ${text}`);
  }
  return res.json();
}

export const setupDomains = action({
  args: {
    id: v.id("deployments"),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const deployment = await ctx.runQuery(api.deployments.get, { id: args.id });
    if (!deployment) throw new Error("Deployment not found");

    const serverIp = process.env.SERVER_IP;
    if (!serverIp) throw new Error("SERVER_IP must be configured");

    // Load project for domain + CF credentials, or fall back to env vars
    let baseDomain: string;
    let cfToken: string | undefined;
    let cfZoneId: string | undefined;
    let certDomain: string | undefined;
    let storedCertId: number | undefined;

    if (args.projectId) {
      const project = await ctx.runQuery(api.projects.get, { id: args.projectId });
      if (!project) throw new Error("Project not found");
      baseDomain = project.domain;
      cfToken = project.cloudflareApiToken;
      cfZoneId = project.cloudflareZoneId;
      certDomain = project.domain;
      storedCertId = project.wildcardCertId ?? undefined;
    } else {
      // Backward compat: use env var
      baseDomain = process.env.BASE_DOMAIN!;
      if (!baseDomain) throw new Error("BASE_DOMAIN must be configured");
    }

    const entries = SUBDOMAIN_ENTRIES[deployment.serviceType];
    if (!entries) {
      throw new Error(`No subdomain pattern for service type: ${deployment.serviceType}`);
    }

    // Get wildcard cert ID for NPM proxy hosts
    const certificateId = storedCertId ?? await (async () => {
      const certPath = certDomain
        ? `/infra/proxy/cert?domain=${encodeURIComponent(certDomain)}`
        : "/infra/proxy/cert";
      const certResult = await infraFetch("GET", certPath) as { certId: number | null };
      if (!certResult.certId) {
        throw new Error("Wildcard certificate not found in Nginx Proxy Manager");
      }
      return certResult.certId;
    })();

    // Advanced config for backend services (WebSocket support)
    const backendAdvancedConfig = "proxy_read_timeout 86400;\nproxy_buffering off;";

    // Track created resources for rollback
    const created: { cloudflareId?: string; npmProxyId?: number }[] = [];

    // Build per-request CF credentials object (only if project-based)
    const cfCreds = cfToken && cfZoneId
      ? { cloudflareApiToken: cfToken, cloudflareZoneId: cfZoneId, baseDomain }
      : {};

    try {
      for (const entry of entries) {
        const portMappings = deployment.portMappings as Record<string, number>;
        const port = portMappings[entry.portKey];
        if (!port) {
          throw new Error(`Missing port mapping for ${entry.portKey}`);
        }

        const subdomain = entry.suffix ? `${deployment.name}${entry.suffix}` : deployment.name;
        const fullDomain = `${subdomain}.${baseDomain}`;

        // Create Cloudflare DNS record (DNS-only, not proxied — NPM handles SSL)
        const dnsResult = await infraFetch("POST", "/infra/dns/create", {
          subdomain,
          ip: serverIp,
          proxied: false,
          ...cfCreds,
        }) as { id: string; name: string };

        created.push({ cloudflareId: dnsResult.id });

        // Create NPM proxy host (infra agent auto-resolves Docker bridge gateway)
        const proxyResult = await infraFetch("POST", "/infra/proxy/create", {
          domainNames: [fullDomain],
          forwardPort: port,
          websocket: entry.websocket,
          certificateId,
          advancedConfig: entry.websocket ? backendAdvancedConfig : "",
        }) as { id: number };

        created[created.length - 1].npmProxyId = proxyResult.id;

        // Store DNS record in database
        await ctx.runMutation(api.dnsRecords.insertRecord, {
          deploymentId: args.id,
          subdomain,
          fullDomain,
          recordType: "A",
          cloudflareId: dnsResult.id,
          npmProxyId: proxyResult.id,
          serviceRole: entry.role,
          targetPort: port,
          websocket: entry.websocket,
          proxied: true,
        });
      }

      // Log the action
      await ctx.runMutation(api.auditLog.append, {
        action: "domain.setup",
        resourceType: "deployment",
        resourceId: args.id,
        details: { recordCount: entries.length },
      });
    } catch (error) {
      // Rollback: delete any created resources
      const cfQueryParams = cfToken && cfZoneId
        ? `?cloudflareApiToken=${encodeURIComponent(cfToken)}&cloudflareZoneId=${encodeURIComponent(cfZoneId)}`
        : "";
      for (const record of created) {
        try {
          if (record.cloudflareId) {
            await infraFetch("DELETE", `/infra/dns/${record.cloudflareId}${cfQueryParams}`);
          }
        } catch {
          // Best-effort rollback
        }
        try {
          if (record.npmProxyId) {
            await infraFetch("DELETE", `/infra/proxy/${record.npmProxyId}`);
          }
        } catch {
          // Best-effort rollback
        }
      }
      throw error;
    }
  },
});

export const teardownDomains = action({
  args: {
    id: v.id("deployments"),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    // Load project for CF credentials if available
    let cfQueryParams = "";
    if (args.projectId) {
      const project = await ctx.runQuery(api.projects.get, { id: args.projectId });
      if (project && project.cloudflareApiToken && project.cloudflareZoneId) {
        cfQueryParams = `?cloudflareApiToken=${encodeURIComponent(project.cloudflareApiToken)}&cloudflareZoneId=${encodeURIComponent(project.cloudflareZoneId)}`;
      }
    }

    const records = await ctx.runQuery(api.dnsRecords.byDeployment, {
      deploymentId: args.id,
    });

    for (const record of records) {
      // Delete Cloudflare record (best-effort)
      if (record.cloudflareId) {
        try {
          await infraFetch("DELETE", `/infra/dns/${record.cloudflareId}${cfQueryParams}`);
        } catch (err) {
          console.error(`Failed to delete CF record ${record.cloudflareId}:`, err);
        }
      }

      // Delete NPM proxy host (best-effort)
      if (record.npmProxyId) {
        try {
          await infraFetch("DELETE", `/infra/proxy/${record.npmProxyId}`);
        } catch (err) {
          console.error(`Failed to delete NPM proxy ${record.npmProxyId}:`, err);
        }
      }

      // Soft-delete the database record
      await ctx.runMutation(api.dnsRecords.softDelete, { id: record._id });
    }

    // Log the action
    await ctx.runMutation(api.auditLog.append, {
      action: "domain.teardown",
      resourceType: "deployment",
      resourceId: args.id,
      details: { recordCount: records.length },
    });
  },
});
