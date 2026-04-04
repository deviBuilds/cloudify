import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("deployments")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("deployments") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const byName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("deployments")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("deployments")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    serviceType: v.union(
      v.literal("convex"),
      v.literal("postgres"),
      v.literal("spacetimedb")
    ),
    status: v.union(
      v.literal("creating"),
      v.literal("running"),
      v.literal("stopped"),
      v.literal("error"),
      v.literal("degraded")
    ),
    containerPrefix: v.string(),
    config: v.any(),
    portMappings: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("deployments")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (existing && !existing.deletedAt) {
      throw new Error(`Deployment "${args.name}" already exists`);
    }
    return await ctx.db.insert("deployments", args);
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("deployments"),
    status: v.union(
      v.literal("creating"),
      v.literal("running"),
      v.literal("stopped"),
      v.literal("error"),
      v.literal("degraded")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const updatePortMappings = mutation({
  args: {
    id: v.id("deployments"),
    portMappings: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { portMappings: args.portMappings });
  },
});

export const updateDomainUrls = mutation({
  args: {
    id: v.id("deployments"),
    domainUrls: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { domainUrls: args.domainUrls });
  },
});

export const softDelete = mutation({
  args: { id: v.id("deployments") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
