import { z } from "zod";

export const appConfigSchema = z.object({
  name: z.string().default("Cloudify"),
  description: z.string().default("Deployment Manager"),
  version: z.string().default("1.0.0"),
});

export const serverConfigSchema = z.object({
  host: z.string().default("0.0.0.0"),
  webPort: z.number().default(3000),
  apiPort: z.number().default(4000),
  serverIp: z.string(),
});

export const domainConfigSchema = z.object({
  baseDomain: z.string(),
  wildcardFallback: z.boolean().default(true),
  scheme: z.enum(["http", "https"]).default("https"),
});

export const cloudflareConfigSchema = z.object({
  apiToken: z.string(),
  zoneId: z.string(),
  proxied: z.boolean().default(true),
  ttl: z.number().default(1),
});

export const npmConfigSchema = z.object({
  url: z.string(),
  email: z.string(),
  password: z.string(),
  wildcardCertDomain: z.string().default("*.devhomelab.org"),
  backendAdvancedConfig: z
    .string()
    .default("proxy_read_timeout 86400;\nproxy_buffering off;"),
});

export const convexConfigSchema = z.object({
  url: z.string().optional(),
  deployKey: z.string().optional(),
});

export const portsConfigSchema = z.object({
  rangeStart: z.number().default(10200),
  rangeEnd: z.number().default(10999),
  reservedPorts: z.array(z.number()).default([80, 443, 3000, 4000, 5432, 6791, 8080]),
});

export const serviceImageConfigSchema = z.record(z.string(), z.string());

export const serviceTypeConfigSchema = z.object({
  enabled: z.boolean().default(false),
  images: serviceImageConfigSchema.optional(),
  subdomainPattern: z.record(z.string(), z.string()).optional(),
});

export const brandingConfigSchema = z.object({
  primaryColor: z.string().default("#6366f1"),
  logo: z.string().default(""),
});

export const cloudifyConfigSchema = z.object({
  app: appConfigSchema.default({}),
  server: serverConfigSchema,
  domain: domainConfigSchema,
  cloudflare: cloudflareConfigSchema,
  nginxProxyManager: npmConfigSchema,
  convex: convexConfigSchema.default({}),
  ports: portsConfigSchema.default({}),
  services: z.record(z.string(), serviceTypeConfigSchema).default({}),
  branding: brandingConfigSchema.default({}),
});

export type CloudifyConfig = z.infer<typeof cloudifyConfigSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;
export type ServerConfig = z.infer<typeof serverConfigSchema>;
export type DomainConfig = z.infer<typeof domainConfigSchema>;
export type CloudflareConfig = z.infer<typeof cloudflareConfigSchema>;
export type NpmConfig = z.infer<typeof npmConfigSchema>;
export type PortsConfig = z.infer<typeof portsConfigSchema>;
export type BrandingConfig = z.infer<typeof brandingConfigSchema>;
