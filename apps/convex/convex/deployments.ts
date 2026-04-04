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
