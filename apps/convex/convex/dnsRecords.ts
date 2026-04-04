import { query } from "./_generated/server";
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

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("dnsRecords")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
  },
});
