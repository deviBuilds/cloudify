import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db.query("auditLog").order("desc").take(limit);
  },
});

export const append = mutation({
  args: {
    action: v.string(),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    details: v.optional(v.any()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLog", {
      action: args.action,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      details: args.details,
      userId: args.userId,
    });
  },
});
