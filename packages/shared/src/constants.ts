export const SERVICE_TYPES = {
  CONVEX: "convex",
  POSTGRES: "postgres",
  SPACETIMEDB: "spacetimedb",
} as const;

export type ServiceType = (typeof SERVICE_TYPES)[keyof typeof SERVICE_TYPES];

export const DEPLOYMENT_STATUSES = {
  CREATING: "creating",
  RUNNING: "running",
  STOPPED: "stopped",
  ERROR: "error",
  DEGRADED: "degraded",
} as const;

export type DeploymentStatus =
  (typeof DEPLOYMENT_STATUSES)[keyof typeof DEPLOYMENT_STATUSES];

export const PORT_RANGE = {
  start: 10200,
  end: 10999,
} as const;

export const RESERVED_PORTS = [
  80, 443, 3000, 4000, 5432, 6791, 8080,
] as const;

export const DEFAULT_API_PORT = 4000;
export const DEFAULT_WEB_PORT = 3000;

export const CONVEX_SUBDOMAIN_PATTERN = {
  backend: "{name}",
  site: "{name}-http",
  dashboard: "{name}-dash",
} as const;

export const CONVEX_PORT_ROLES = [
  "postgres",
  "backend",
  "site",
  "dashboard",
] as const;

export type ConvexPortRole = (typeof CONVEX_PORT_ROLES)[number];
