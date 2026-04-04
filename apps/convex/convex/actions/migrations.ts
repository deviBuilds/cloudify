"use node";
import { action } from "../_generated/server";
import { api } from "../_generated/api";

export const migrateToProjects = action({
  args: {},
  handler: async (ctx) => {
    // Check if default project already exists (idempotent)
    const existing = await ctx.runQuery(api.projects.getDefault, {});
    if (existing) {
      return { skipped: true, message: "Default project already exists" };
    }

    const baseDomain = process.env.BASE_DOMAIN;
    const cfToken = process.env.CLOUDFLARE_API_TOKEN;
    const cfZoneId = process.env.CLOUDFLARE_ZONE_ID;

    if (!baseDomain || !cfToken || !cfZoneId) {
      throw new Error(
        "BASE_DOMAIN, CLOUDFLARE_API_TOKEN, and CLOUDFLARE_ZONE_ID env vars must be set for migration"
      );
    }

    // Create the default project
    const projectId = await ctx.runMutation(api.projects.create, {
      name: "Default",
      domain: baseDomain,
      cloudflareApiToken: cfToken,
      cloudflareZoneId: cfZoneId,
      scheme: "https",
      isDefault: true,
    });

    // Discover wildcard cert
    try {
      await ctx.runAction(api.actions.projectActions.discoverWildcardCert, {
        projectId,
      });
    } catch (err) {
      console.error("Failed to discover wildcard cert during migration:", err);
    }

    // Backfill existing deployments with the default project ID
    const deployments = await ctx.runQuery(api.deployments.list, {});
    let backfilled = 0;
    for (const d of deployments) {
      if (!d.projectId) {
        await ctx.runMutation(api.projects.setProjectId, {
          deploymentId: d._id,
          projectId,
        });
        backfilled++;
      }
    }

    // Audit log
    await ctx.runMutation(api.auditLog.append, {
      action: "migration.projects",
      resourceType: "system",
      details: { projectId, backfilled, domain: baseDomain },
    });

    return {
      skipped: false,
      projectId,
      backfilled,
      message: `Created default project for ${baseDomain}, backfilled ${backfilled} deployment(s)`,
    };
  },
});
