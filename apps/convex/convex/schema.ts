import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  projects: defineTable({
    name: v.string(),
    domain: v.string(),
    cloudflareApiToken: v.string(),
    cloudflareZoneId: v.string(),
    wildcardCertId: v.optional(v.number()),
    scheme: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_domain", ["domain"])
    .index("by_default", ["isDefault"]),

  deployments: defineTable({
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
    domainUrls: v.optional(v.any()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_name", ["name"])
    .index("by_status", ["status"])
    .index("by_project", ["projectId"]),

  dnsRecords: defineTable({
    deploymentId: v.id("deployments"),
    subdomain: v.string(),
    fullDomain: v.string(),
    recordType: v.string(),
    cloudflareId: v.optional(v.string()),
    npmProxyId: v.optional(v.number()),
    serviceRole: v.string(),
    targetPort: v.number(),
    websocket: v.boolean(),
    proxied: v.boolean(),
    deletedAt: v.optional(v.number()),
  }).index("by_deployment", ["deploymentId"]),

  credentials: defineTable({
    deploymentId: v.id("deployments"),
    keyType: v.string(),
    keyValue: v.string(),
    rotatedAt: v.optional(v.number()),
  }).index("by_deployment", ["deploymentId"]),

  portAllocations: defineTable({
    deploymentId: v.id("deployments"),
    port: v.number(),
    role: v.string(),
  })
    .index("by_port", ["port"])
    .index("by_deployment", ["deploymentId"]),

  auditLog: defineTable({
    userId: v.optional(v.string()),
    action: v.string(),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    details: v.optional(v.any()),
  }),
});
