"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";

export const start = action({
  args: { id: v.id("deployments") },
  handler: async (ctx, args) => {
    // TODO: Implement in Milestone 4
    // 1. Get deployment
    // 2. Docker compose up
    // 3. Update status to "running"
    throw new Error("Not implemented");
  },
});

export const stop = action({
  args: { id: v.id("deployments") },
  handler: async (ctx, args) => {
    // TODO: Implement in Milestone 4
    // 1. Get deployment
    // 2. Docker compose stop
    // 3. Update status to "stopped"
    throw new Error("Not implemented");
  },
});

export const restart = action({
  args: { id: v.id("deployments") },
  handler: async (ctx, args) => {
    // TODO: Implement in Milestone 4
    // 1. Get deployment
    // 2. Docker compose restart
    // 3. Update status to "running"
    throw new Error("Not implemented");
  },
});
