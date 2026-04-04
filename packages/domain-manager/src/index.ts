// Types
export type {
  DomainConfig,
  ProxyHostConfig,
  DNSRecord,
  ProxyHost,
  SubdomainSetupResult,
} from "./types.js";

// Cloudflare
export { CloudflareManager } from "./cloudflare.js";

// Nginx Proxy Manager
export { NginxProxyManager } from "./nginx-proxy.js";

// Domain Orchestrator
export { DomainOrchestrator } from "./domain.js";

// SSL
export { discoverWildcardCert } from "./ssl.js";
