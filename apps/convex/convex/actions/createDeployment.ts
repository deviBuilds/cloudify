"use node";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";

const DEPLOYMENT_DIR = "/opt/cloudify/deployments";

function generateConvexComposeConfig(opts: {
  name: string;
  projectName: string;
  ports: { postgres: number; backend: number; site: number; dashboard: number };
  serverIp: string;
  baseDomain: string;
  scheme?: string;
}): Record<string, unknown> {
  const { name, projectName, ports, baseDomain, scheme = "https" } = opts;
  const prefix = `${name}-${projectName}`;
  const pgUser = `${name}-postgres-db`;
  const pgPassword = `${name}-pg-password`;
  const pgDb = "convex_self_hosted";

  return {
    services: {
      postgres: {
        image: "postgres:16-alpine",
        container_name: `${prefix}-postgres-db`,
        environment: {
          POSTGRES_USER: pgUser,
          POSTGRES_PASSWORD: pgPassword,
          POSTGRES_DB: pgDb,
        },
        command: `-p ${ports.postgres}`,
        ports: [`${ports.postgres}:${ports.postgres}`],
        healthcheck: {
          test: ["CMD-SHELL", `pg_isready -U ${pgUser} -d ${pgDb} -p ${ports.postgres}`],
          interval: "5s",
          timeout: "3s",
          retries: 10,
        },
        restart: "unless-stopped",
        volumes: [`${prefix}_pgdata:/var/lib/postgresql/data`],
      },
      backend: {
        image: "ghcr.io/get-convex/convex-backend:latest",
        container_name: `${prefix}-convex-backend`,
        depends_on: { postgres: { condition: "service_healthy" } },
        environment: {
          POSTGRES_URL: `postgresql://${pgUser}:${pgPassword}@${prefix}-postgres-db:${ports.postgres}`,
          CONVEX_CLOUD_ORIGIN: `${scheme}://${name}-convex-backend.${baseDomain}`,
          CONVEX_SITE_ORIGIN: `${scheme}://${name}-convex-actions.${baseDomain}`,
          DO_NOT_REQUIRE_SSL: "true",
        },
        ports: [`${ports.backend}:3210`, `${ports.site}:3211`],
        healthcheck: {
          test: ["CMD-SHELL", "curl -f http://localhost:3210/version"],
          interval: "5s",
          start_period: "15s",
        },
        restart: "unless-stopped",
        volumes: [`${prefix}_convex_data:/convex/data`],
      },
      dashboard: {
        image: "ghcr.io/get-convex/convex-dashboard:latest",
        container_name: `${prefix}-convex-dashboard`,
        depends_on: { backend: { condition: "service_healthy" } },
        environment: {
          NEXT_PUBLIC_DEPLOYMENT_URL: `${scheme}://${name}-convex-backend.${baseDomain}`,
        },
        ports: [`${ports.dashboard}:6791`],
        restart: "unless-stopped",
      },
    },
    volumes: {
      [`${prefix}_pgdata`]: {},
      [`${prefix}_convex_data`]: {},
    },
  };
}

async function infraFetch(method: string, path: string, body?: unknown) {
  const url = process.env.INFRA_AGENT_URL;
  const secret = process.env.INFRA_AGENT_SECRET;
  if (!url || !secret) {
    throw new Error("INFRA_AGENT_URL and INFRA_AGENT_SECRET must be configured");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${secret}`,
  };
  const options: RequestInit = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${url}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Infra agent error ${res.status}: ${text}`);
  }
  return res.json();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const createDeployment = action({
  args: {
    name: v.string(),
    serviceType: v.union(
      v.literal("convex"),
      v.literal("postgres"),
      v.literal("spacetimedb")
    ),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const { name, serviceType, projectId } = args;

    // Only Convex is supported for now
    if (serviceType !== "convex") {
      throw new Error(`Service type "${serviceType}" is not yet supported`);
    }

    // Validate name uniqueness
    const existing = await ctx.runQuery(api.deployments.byName, { name });
    if (existing && !existing.deletedAt) {
      throw new Error(`Deployment "${name}" already exists`);
    }

    // Load project for domain config
    const project = await ctx.runQuery(api.projects.get, { id: projectId });
    if (!project || project.deletedAt) {
      throw new Error("Project not found");
    }

    const serverIp = process.env.SERVER_IP;
    if (!serverIp) {
      throw new Error("SERVER_IP must be configured");
    }
    const baseDomain = project.domain;

    // Step 1: Create deployment record
    const deploymentId = await ctx.runMutation(api.deployments.create, {
      name,
      serviceType,
      projectId,
      status: "creating",
      containerPrefix: `${name}-${project.name}`,
      config: {},
      portMappings: {},
    });

    // Track rollback state
    let portsAllocated = false;
    let domainsSetup = false;
    let composeStarted = false;
    const dir = `${DEPLOYMENT_DIR}/${name}`;

    try {
      // Step 2: Allocate ports
      const ports = await ctx.runMutation(api.portAllocations.allocatePorts, {
        deploymentId,
        roles: ["postgres", "backend", "site", "dashboard"],
      });
      portsAllocated = true;

      const portMappings = {
        postgres: ports[0],
        backend: ports[1],
        site: ports[2],
        dashboard: ports[3],
      };

      // Step 3: Update port mappings on deployment
      await ctx.runMutation(api.deployments.updatePortMappings, {
        id: deploymentId,
        portMappings,
      });

      // Step 4: Setup domains (CF DNS + NPM proxies)
      await ctx.runAction(api.actions.domainActions.setupDomains, { id: deploymentId, projectId });
      domainsSetup = true;

      // Step 5: Generate compose config
      const composeConfig = generateConvexComposeConfig({
        name,
        projectName: project.name,
        ports: portMappings,
        serverIp,
        baseDomain,
      });

      // Step 6: Write compose file
      await infraFetch("POST", "/infra/compose/write", {
        dir,
        compose: composeConfig,
      });

      // Step 7: Compose up
      await infraFetch("POST", "/infra/compose/up", { dir });
      composeStarted = true;

      // Step 8: Wait for health (60s timeout, 5s interval)
      const containerPrefix = `${name}-${project.name}`;
      const backendContainer = `${containerPrefix}-convex-backend`;
      let healthy = false;
      for (let attempt = 0; attempt < 12; attempt++) {
        await sleep(5000);
        try {
          const containers = (await infraFetch(
            "GET",
            `/infra/containers?prefix=${containerPrefix}`
          )) as { name: string; state: string }[];
          const backend = containers.find((c) => c.name === backendContainer);
          if (backend && backend.state === "running") {
            healthy = true;
            break;
          }
        } catch {
          // Container might not be ready yet
        }
      }

      if (!healthy) {
        throw new Error("Backend container did not become healthy within 60 seconds");
      }

      // Step 9: Generate admin key
      const credResult = (await infraFetch("POST", "/infra/credentials/generate", {
        containerName: backendContainer,
      })) as { adminKey: string };

      // Step 10: Store credential
      await ctx.runMutation(api.credentials.insertCredential, {
        deploymentId,
        keyType: "admin_key",
        keyValue: credResult.adminKey,
      });

      // Step 11: Update deployment to running with domain URLs
      const domainUrls = {
        backend: `https://${name}-convex-backend.${baseDomain}`,
        site: `https://${name}-convex-actions.${baseDomain}`,
        dashboard: `https://${name}-convex-dashboard.${baseDomain}`,
      };
      await ctx.runMutation(api.deployments.updateStatus, {
        id: deploymentId,
        status: "running",
      });
      await ctx.runMutation(api.deployments.updateDomainUrls, {
        id: deploymentId,
        domainUrls,
      });

      // Step 12: Audit log
      await ctx.runMutation(api.auditLog.append, {
        action: "deployment.create",
        resourceType: "deployment",
        resourceId: deploymentId,
        details: { name, serviceType, ports: portMappings },
      });

      return {
        id: deploymentId,
        adminKey: credResult.adminKey,
        domainUrls,
        portMappings,
      };
    } catch (error) {
      // Rollback: best-effort cleanup
      if (composeStarted) {
        try {
          await infraFetch("POST", "/infra/compose/down", {
            dir,
            removeVolumes: true,
          });
        } catch {
          // Best-effort
        }
      }

      if (domainsSetup) {
        try {
          await ctx.runAction(api.actions.domainActions.teardownDomains, {
            id: deploymentId,
          });
        } catch {
          // Best-effort
        }
      }

      if (portsAllocated) {
        try {
          await ctx.runMutation(api.portAllocations.releasePorts, {
            deploymentId,
          });
        } catch {
          // Best-effort
        }
      }

      // Mark deployment as error
      try {
        await ctx.runMutation(api.deployments.updateStatus, {
          id: deploymentId,
          status: "error",
        });
      } catch {
        // Best-effort
      }

      throw error;
    }
  },
});
