export interface DomainConfig {
  baseDomain: string;
  serverIp: string;
  scheme: "http" | "https";
  cloudflare: {
    apiToken: string;
    zoneId: string;
    proxied: boolean;
    ttl: number;
  };
  npm: {
    url: string;
    email: string;
    password: string;
    wildcardCertDomain: string;
    backendAdvancedConfig: string;
  };
}

export interface ProxyHostConfig {
  domain_names: string[];
  forward_scheme: "http" | "https";
  forward_host: string;
  forward_port: number;
  allow_websocket_upgrade: boolean;
  certificate_id: number;
  ssl_forced: boolean;
  http2_support: boolean;
  block_exploits: boolean;
  advanced_config: string;
}

export interface DNSRecord {
  id: string;
  name: string;
  type: string;
  content: string;
  proxied: boolean;
  ttl: number;
}

export interface ProxyHost {
  id: number;
  domain_names: string[];
  forward_host: string;
  forward_port: number;
}

export interface SubdomainSetupResult {
  subdomain: string;
  fullDomain: string;
  cloudflareId: string;
  npmProxyId: number;
  role: string;
}
