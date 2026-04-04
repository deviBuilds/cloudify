import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const byDeployment = query({
  args: { deploymentId: v.id("deployments") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("dnsRecords")
      .withIndex("by_deployment", (q) => q.eq("deploymentId", args.deploymentId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
  },
});

export const insertRecord = mutation({
  args: {
    deploymentId: v.id("deployments"),
    subdomain: v.string(),
    fullDomain: v.string(),
    recordType: v.string(),
    cloudflareId: v.optional(v.string()),
    npmProxyId: v.optional(v.number()),
    serviceRole: v.string(),
    targetPort: v.number(),
    websocket: v.boolean(),
    proxied: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("dnsRecords", args);
  },
});

export const softDelete = mutation({
  args: { id: v.id("dnsRecords") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { deletedAt: Date.now() });
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("dnsRecords")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
  },
});
