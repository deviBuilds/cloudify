"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";

export const createDeployment = action({
  args: {
    name: v.string(),
    serviceType: v.union(
      v.literal("convex"),
      v.literal("postgres"),
      v.literal("spacetimedb")
    ),
  },
  handler: async (ctx, args) => {
    // TODO: Implement in Milestone 4
    // 1. Validate name
    // 2. Allocate ports
    // 3. Setup DNS (CF records + NPM proxies)
    // 4. Write compose file
    // 5. Compose up
    // 6. Generate credentials
    // 7. Store deployment
    throw new Error("Not implemented");
  },
});
