import { z } from "zod";

// Compose operations
export const composeWriteRequestSchema = z.object({
  dir: z.string(),
  compose: z.record(z.string(), z.unknown()),
  envVars: z.record(z.string(), z.string()).optional(),
});

export const composeUpRequestSchema = z.object({
  dir: z.string(),
});

export const composeDownRequestSchema = z.object({
  dir: z.string(),
  removeVolumes: z.boolean().default(false),
});

// DNS operations
export const dnsCreateRequestSchema = z.object({
  subdomain: z.string(),
  ip: z.string(),
  proxied: z.boolean().default(false),
});

export const dnsCreateResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
});

// Proxy operations
export const proxyCreateRequestSchema = z.object({
  domainNames: z.array(z.string()),
  forwardHost: z.string().optional(),
  forwardPort: z.number(),
  websocket: z.boolean().default(false),
  certificateId: z.number(),
  advancedConfig: z.string().default(""),
});

export const proxyCreateResponseSchema = z.object({
  id: z.number(),
});

// Credentials
export const credentialsGenerateRequestSchema = z.object({
  containerName: z.string(),
});

export const credentialsGenerateResponseSchema = z.object({
  adminKey: z.string(),
});

// Metrics
export const systemMetricsResponseSchema = z.object({
  cpu: z.object({
    usage: z.number(),
    cores: z.number(),
  }),
  memory: z.object({
    total: z.number(),
    used: z.number(),
    free: z.number(),
    usagePercent: z.number(),
  }),
  disk: z.object({
    total: z.number(),
    used: z.number(),
    free: z.number(),
    usagePercent: z.number(),
  }),
  uptime: z.number(),
  loadAvg: z.array(z.number()),
});

export const containerStatsSchema = z.object({
  id: z.string(),
  name: z.string(),
  cpuPercent: z.number(),
  memUsage: z.number(),
  memLimit: z.number(),
  netInput: z.number(),
  netOutput: z.number(),
});

export const healthResponseSchema = z.object({
  status: z.string(),
  version: z.string(),
  uptime: z.number(),
});

// Inferred types
export type ComposeWriteRequest = z.infer<typeof composeWriteRequestSchema>;
export type ComposeUpRequest = z.infer<typeof composeUpRequestSchema>;
export type ComposeDownRequest = z.infer<typeof composeDownRequestSchema>;
export type DnsCreateRequest = z.infer<typeof dnsCreateRequestSchema>;
export type DnsCreateResponse = z.infer<typeof dnsCreateResponseSchema>;
export type ProxyCreateRequest = z.infer<typeof proxyCreateRequestSchema>;
export type ProxyCreateResponse = z.infer<typeof proxyCreateResponseSchema>;
export type CredentialsGenerateRequest = z.infer<typeof credentialsGenerateRequestSchema>;
export type CredentialsGenerateResponse = z.infer<typeof credentialsGenerateResponseSchema>;
export type SystemMetricsResponse = z.infer<typeof systemMetricsResponseSchema>;
export type ContainerStats = z.infer<typeof containerStatsSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
