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

export const start = action({
  args: { id: v.id("deployments") },
  handler: async (ctx, args) => {
    const deployment = await ctx.runQuery(api.deployments.get, { id: args.id });
    if (!deployment) throw new Error("Deployment not found");

    const dir = `${DEPLOYMENT_DIR}/${deployment.name}`;

    try {
      await infraFetch("POST", "/infra/compose/up", { dir });
      await ctx.runMutation(api.deployments.updateStatus, {
        id: args.id,
        status: "running",
      });
      await ctx.runMutation(api.auditLog.append, {
        action: "deployment.start",
        resourceType: "deployment",
        resourceId: args.id,
      });
    } catch (error) {
      await ctx.runMutation(api.deployments.updateStatus, {
        id: args.id,
        status: "error",
      });
      throw error;
    }
  },
});

export const stop = action({
  args: { id: v.id("deployments") },
  handler: async (ctx, args) => {
    const deployment = await ctx.runQuery(api.deployments.get, { id: args.id });
    if (!deployment) throw new Error("Deployment not found");

    const dir = `${DEPLOYMENT_DIR}/${deployment.name}`;

    try {
      await infraFetch("POST", "/infra/compose/stop", { dir });
      await ctx.runMutation(api.deployments.updateStatus, {
        id: args.id,
        status: "stopped",
      });
      await ctx.runMutation(api.auditLog.append, {
        action: "deployment.stop",
        resourceType: "deployment",
        resourceId: args.id,
      });
    } catch (error) {
      await ctx.runMutation(api.deployments.updateStatus, {
        id: args.id,
        status: "error",
      });
      throw error;
    }
  },
});

export const restart = action({
  args: { id: v.id("deployments") },
  handler: async (ctx, args) => {
    const deployment = await ctx.runQuery(api.deployments.get, { id: args.id });
    if (!deployment) throw new Error("Deployment not found");

    const dir = `${DEPLOYMENT_DIR}/${deployment.name}`;

    try {
      await infraFetch("POST", "/infra/compose/restart", { dir });
      await ctx.runMutation(api.deployments.updateStatus, {
        id: args.id,
        status: "running",
      });
      await ctx.runMutation(api.auditLog.append, {
        action: "deployment.restart",
        resourceType: "deployment",
        resourceId: args.id,
      });
    } catch (error) {
      await ctx.runMutation(api.deployments.updateStatus, {
        id: args.id,
        status: "error",
      });
      throw error;
    }
  },
});
