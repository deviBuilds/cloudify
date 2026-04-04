import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skip type checking during build — Convex codegen types don't exist until backend runs.
  // Remove this once `npx convex dev` has generated _generated/ types.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
