import type { ServiceType } from "../constants.js";

export interface SubdomainEntry {
  suffix: string;
  role: string;
  port: number;
  websocket: boolean;
}

export interface ServiceConfig {
  [key: string]: unknown;
}

export interface CreateOptions {
  name: string;
  portMappings: Record<string, number>;
  serverIp: string;
  baseDomain: string;
  scheme: string;
}

export interface ServiceStatus {
  healthy: boolean;
  containers: {
    name: string;
    status: string;
    health?: string;
  }[];
}

export interface ServiceMetrics {
  containers: {
    name: string;
    cpuPercent: number;
    memUsage: number;
    memLimit: number;
  }[];
}

export interface ComposeSpec {
  version?: string;
  services: Record<string, unknown>;
  volumes?: Record<string, unknown>;
  networks?: Record<string, unknown>;
}

export interface ServiceProvider {
  type: ServiceType;
  displayName: string;
  icon: string;
  defaultConfig: ServiceConfig;

  generateComposeConfig(opts: CreateOptions): ComposeSpec;
  getSubdomainEntries(name: string): SubdomainEntry[];
}
