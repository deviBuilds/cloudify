"use node";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";

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

export const validateCloudflare = action({
  args: {
    apiToken: v.string(),
    zoneId: v.string(),
  },
  handler: async (_ctx, args) => {
    try {
      const result = (await infraFetch(
        "GET",
        `/infra/dns/verify?cloudflareApiToken=${encodeURIComponent(args.apiToken)}&cloudflareZoneId=${encodeURIComponent(args.zoneId)}`
      )) as { connected: boolean };
      return { connected: result.connected };
    } catch (err) {
      return {
        connected: false,
        error: err instanceof Error ? err.message : "Connection failed",
      };
    }
  },
});

export const ensureServerDnsRecord = action({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.runQuery(api.projects.get, { id: args.projectId });
    if (!project) throw new Error("Project not found");

    const serverIp = process.env.SERVER_IP;
    if (!serverIp) throw new Error("SERVER_IP must be configured");

    // List existing DNS records to check if server IP is already mapped
    const records = (await infraFetch(
      "GET",
      `/infra/dns/list?cloudflareApiToken=${encodeURIComponent(project.cloudflareApiToken)}&cloudflareZoneId=${encodeURIComponent(project.cloudflareZoneId)}`
    )) as { id: string; name: string; type: string; content: string }[];

    // Check if root domain A record pointing to server IP already exists
    const rootRecord = records.find(
      (r) =>
        r.type === "A" &&
        r.content === serverIp &&
        (r.name === project.domain || r.name === "@")
    );

    if (rootRecord) {
      return { created: false, message: "A record already exists" };
    }

    // Create A record for root domain
    await infraFetch("POST", "/infra/dns/create", {
      subdomain: "@",
      ip: serverIp,
      proxied: false,
      baseDomain: project.domain,
      cloudflareApiToken: project.cloudflareApiToken,
      cloudflareZoneId: project.cloudflareZoneId,
    });

    return { created: true, message: "A record created for server IP" };
  },
});

export const discoverWildcardCert = action({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.runQuery(api.projects.get, { id: args.projectId });
    if (!project) throw new Error("Project not found");

    const certResult = (await infraFetch(
      "GET",
      `/infra/proxy/cert?domain=${encodeURIComponent(project.domain)}`
    )) as { certId: number | null; domain: string };

    if (certResult.certId) {
      await ctx.runMutation(api.projects.updateWildcardCertId, {
        id: args.projectId,
        wildcardCertId: certResult.certId,
      });
    }

    return {
      found: certResult.certId !== null,
      certId: certResult.certId,
      domain: certResult.domain,
    };
  },
});
