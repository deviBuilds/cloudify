import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("portAllocations").collect();
  },
});

const RESERVED_PORTS = [80, 443, 3000, 3001, 3210, 3211, 3213, 3214, 4000, 5432, 5433, 6791, 8080, 10200, 10201, 10202, 10203];
const PORT_RANGE_START = 10210;
const PORT_RANGE_END = 10999;

export const isPortAvailable = query({
  args: { port: v.number() },
  handler: async (ctx, args) => {
    if (RESERVED_PORTS.includes(args.port)) return false;
    if (args.port < PORT_RANGE_START || args.port > PORT_RANGE_END) return false;
    const existing = await ctx.db
      .query("portAllocations")
      .withIndex("by_port", (q) => q.eq("port", args.port))
      .first();
    return !existing;
  },
});

export const allocatePorts = mutation({
  args: {
    deploymentId: v.id("deployments"),
    roles: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("portAllocations").collect();
    const usedPorts = new Set(existing.map((a) => a.port));
    const reservedSet = new Set(RESERVED_PORTS);
    const count = args.roles.length;

    const allocated: number[] = [];
    for (let port = PORT_RANGE_START; port <= PORT_RANGE_END && allocated.length < count; port++) {
      if (!usedPorts.has(port) && !reservedSet.has(port)) {
        allocated.push(port);
      }
    }

    if (allocated.length < count) {
      throw new Error(
        `Not enough available ports. Requested ${count}, found ${allocated.length}`
      );
    }

    for (let i = 0; i < allocated.length; i++) {
      await ctx.db.insert("portAllocations", {
        deploymentId: args.deploymentId,
        port: allocated[i],
        role: args.roles[i],
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
