import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { cloudifyConfigSchema, type CloudifyConfig } from "@cloudify/shared";

let cachedConfig: CloudifyConfig | null = null;

function findConfigFile(): string {
  const envPath = process.env.CLOUDIFY_CONFIG_PATH;
  if (envPath) return path.resolve(envPath);

  // Walk up from api/src/config to find cloudify.config.yml at project root
  let dir = path.resolve(import.meta.dirname || __dirname, "../../..");
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, "cloudify.config.yml");
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }

  throw new Error("cloudify.config.yml not found. Set CLOUDIFY_CONFIG_PATH env var.");
}

function applyEnvOverrides(config: Record<string, unknown>): Record<string, unknown> {
  const env = process.env;

  // Server
  if (env.SERVER_IP) {
    (config.server as Record<string, unknown>).serverIp = env.SERVER_IP;
  }

  // Domain
  if (env.BASE_DOMAIN) {
    (config.domain as Record<string, unknown>).baseDomain = env.BASE_DOMAIN;
  }

  // Cloudflare
  if (env.CLOUDFLARE_API_TOKEN) {
    (config.cloudflare as Record<string, unknown>).apiToken = env.CLOUDFLARE_API_TOKEN;
  }
  if (env.CLOUDFLARE_ZONE_ID) {
    (config.cloudflare as Record<string, unknown>).zoneId = env.CLOUDFLARE_ZONE_ID;
  }

  // NPM
  if (env.NPM_URL) {
    (config.nginxProxyManager as Record<string, unknown>).url = env.NPM_URL;
  }
  if (env.NPM_EMAIL) {
    (config.nginxProxyManager as Record<string, unknown>).email = env.NPM_EMAIL;
  }
  if (env.NPM_PASSWORD) {
    (config.nginxProxyManager as Record<string, unknown>).password = env.NPM_PASSWORD;
  }

  // Convex
  if (env.NEXT_PUBLIC_CONVEX_URL || env.CLOUDIFY_CONVEX_URL) {
    (config.convex as Record<string, unknown>).url = env.NEXT_PUBLIC_CONVEX_URL || env.CLOUDIFY_CONVEX_URL;
  }
  if (env.CONVEX_DEPLOY_KEY) {
    (config.convex as Record<string, unknown>).deployKey = env.CONVEX_DEPLOY_KEY;
  }

  return config;
}

export function getConfig(): CloudifyConfig {
  if (cachedConfig) return cachedConfig;

  const configPath = findConfigFile();
  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed = yaml.load(raw) as Record<string, unknown>;
  const withEnv = applyEnvOverrides(parsed);
  const validated = cloudifyConfigSchema.parse(withEnv);

  cachedConfig = Object.freeze(validated) as CloudifyConfig;
  return cachedConfig;
}

export function resetConfig(): void {
  cachedConfig = null;
}
