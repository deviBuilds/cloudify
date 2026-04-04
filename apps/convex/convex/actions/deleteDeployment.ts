"use node";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";

const DEPLOYMENT_DIR = "/opt/cloudify/deployments";

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

export const deleteDeployment = action({
  args: {
    id: v.id("deployments"),
  },
  handler: async (ctx, args) => {
    const deployment = await ctx.runQuery(api.deployments.get, { id: args.id });
    if (!deployment) throw new Error("Deployment not found");

    const dir = `${DEPLOYMENT_DIR}/${deployment.name}`;

    // Step 1: Compose down with volumes
    try {
      await infraFetch("POST", "/infra/compose/down", {
        dir,
        removeVolumes: true,
      });
    } catch (err) {
      console.error("Failed to compose down:", err);
    }

    // Step 2: Teardown DNS records + NPM proxies
    try {
      await ctx.runAction(api.actions.domainActions.teardownDomains, { id: args.id });
    } catch (err) {
      console.error("Failed to teardown domains:", err);
    }

    // Step 3: Release ports
    try {
      await ctx.runMutation(api.portAllocations.releasePorts, {
        deploymentId: args.id,
      });
    } catch (err) {
      console.error("Failed to release ports:", err);
    }

    // Step 4: Soft-delete deployment
    await ctx.runMutation(api.deployments.softDelete, { id: args.id });

    // Step 5: Audit log
    await ctx.runMutation(api.auditLog.append, {
      action: "deployment.delete",
      resourceType: "deployment",
      resourceId: args.id,
      details: { name: deployment.name },
    });
  },
});
