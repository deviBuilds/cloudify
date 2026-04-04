import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("portAllocations").collect();
  },
});

export const allocatePorts = mutation({
  args: {
    deploymentId: v.id("deployments"),
    count: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("portAllocations").collect();
    const usedPorts = new Set(existing.map((a) => a.port));

    const allocated: number[] = [];
    for (let port = 10200; port <= 10999 && allocated.length < args.count; port++) {
      if (!usedPorts.has(port)) {
        allocated.push(port);
      }
    }

    if (allocated.length < args.count) {
      throw new Error(
        `Not enough available ports. Requested ${args.count}, found ${allocated.length}`
      );
    }

    for (const port of allocated) {
      await ctx.db.insert("portAllocations", {
        deploymentId: args.deploymentId,
        port,
        role: `port-${port}`,
      });
    }

    return allocated;
  },
});

export const releasePorts = mutation({
  args: { deploymentId: v.id("deployments") },
  handler: async (ctx, args) => {
    const allocations = await ctx.db
      .query("portAllocations")
      .withIndex("by_deployment", (q) => q.eq("deploymentId", args.deploymentId))
      .collect();

    for (const allocation of allocations) {
      await ctx.db.delete(allocation._id);
    }
  },
});
