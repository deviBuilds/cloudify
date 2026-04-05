export interface ConvexComposeOptions {
  name: string;
  projectName: string;
  ports: {
    postgres: number;
    backend: number;
    site: number;
    dashboard: number;
  };
  serverIp: string;
  baseDomain: string;
  scheme?: string;
}

/**
 * Generates a Docker Compose config object for a self-hosted Convex deployment.
 *
 * CRITICAL: The postgres healthcheck uses the correct port, user, and db name
 * matching the service configuration. This was a hard debugging lesson.
 */
export function generateConvexComposeConfig(
  opts: ConvexComposeOptions
): Record<string, unknown> {
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
          test: [
            "CMD-SHELL",
            `pg_isready -U ${pgUser} -d ${pgDb} -p ${ports.postgres}`,
          ],
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
        depends_on: {
          postgres: {
            condition: "service_healthy",
          },
        },
        environment: {
          POSTGRES_URL: `postgresql://${pgUser}:${pgPassword}@${prefix}-postgres-db:${ports.postgres}`,
          CONVEX_CLOUD_ORIGIN: `${scheme}://${name}-convex-backend.${baseDomain}`,
          CONVEX_SITE_ORIGIN: `${scheme}://${name}-convex-actions.${baseDomain}`,
          DO_NOT_REQUIRE_SSL: "true",
        },
        ports: [
          `${ports.backend}:3210`,
          `${ports.site}:3211`,
        ],
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
        depends_on: {
          backend: {
            condition: "service_healthy",
          },
        },
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
