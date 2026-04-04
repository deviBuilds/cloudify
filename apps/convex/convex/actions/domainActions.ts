"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";

export const setupDomains = action({
  args: { id: v.id("deployments") },
  handler: async (ctx, args) => {
    // TODO: Implement in Milestone 4
    // 1. Get deployment config
    // 2. Create Cloudflare DNS records
    // 3. Create NPM proxy hosts
    // 4. Store DNS records in database
    throw new Error("Not implemented");
  },
});

export const teardownDomains = action({
  args: { id: v.id("deployments") },
  handler: async (ctx, args) => {
    // TODO: Implement in Milestone 4
    // 1. Get DNS records for deployment
    // 2. Delete Cloudflare DNS records
    // 3. Delete NPM proxy hosts
    // 4. Soft-delete DNS records in database
    throw new Error("Not implemented");
  },
});
