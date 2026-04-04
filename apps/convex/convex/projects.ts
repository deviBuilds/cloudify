import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getDefault = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_default", (q) => q.eq("isDefault", true))
      .first();
  },
});

export const byDomain = query({
  args: { domain: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_domain", (q) => q.eq("domain", args.domain))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .first();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    domain: v.string(),
    cloudflareApiToken: v.string(),
    cloudflareZoneId: v.string(),
    scheme: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_domain", (q) => q.eq("domain", args.domain))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .first();
    if (existing) {
      throw new Error(`Project with domain "${args.domain}" already exists`);
    }
    return await ctx.db.insert("projects", {
      ...args,
      scheme: args.scheme ?? "https",
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    cloudflareApiToken: v.optional(v.string()),
    cloudflareZoneId: v.optional(v.string()),
    scheme: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) patch[k] = val;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(id, patch);
    }
  },
});

export const updateWildcardCertId = mutation({
  args: {
    id: v.id("projects"),
    wildcardCertId: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      wildcardCertId: args.wildcardCertId ?? undefined,
    });
  },
});

export const setProjectId = mutation({
  args: {
    deploymentId: v.id("deployments"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.deploymentId, { projectId: args.projectId });
  },
});

export const softDelete = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    // Check for active deployments
    const deployments = await ctx.db
      .query("deployments")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
    if (deployments.length > 0) {
      throw new Error(
        `Cannot delete project with ${deployments.length} active deployment(s). Delete deployments first.`
      );
    }
    await ctx.db.patch(args.id, { deletedAt: Date.now() });
  },
});
