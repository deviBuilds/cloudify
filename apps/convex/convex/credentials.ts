import { query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { deploymentId: v.id("deployments") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("credentials")
      .withIndex("by_deployment", (q) => q.eq("deploymentId", args.deploymentId))
      .collect();
  },
});
