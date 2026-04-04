"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";

export const deleteDeployment = action({
  args: {
    id: v.id("deployments"),
  },
  handler: async (ctx, args) => {
    // TODO: Implement in Milestone 4
    // 1. Stop containers
    // 2. Teardown DNS records
    // 3. Release ports
    // 4. Soft-delete deployment
    throw new Error("Not implemented");
  },
});
