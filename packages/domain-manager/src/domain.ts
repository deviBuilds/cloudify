import type { SubdomainEntry } from "@cloudify/shared";
import type { CloudflareManager } from "./cloudflare.js";
import type { NginxProxyManager } from "./nginx-proxy.js";
import type {
  DomainConfig,
  ProxyHostConfig,
  SubdomainSetupResult,
} from "./types.js";

export class DomainOrchestrator {
  private cloudflare: CloudflareManager;
  private npm: NginxProxyManager;
  private config: DomainConfig;

  constructor({
    cloudflare,
    npm,
    config,
  }: {
    cloudflare: CloudflareManager;
    npm: NginxProxyManager;
    config: DomainConfig;
  }) {
    this.cloudflare = cloudflare;
    this.npm = npm;
    this.config = config;
  }

  async setupDomains(
    name: string,
    entries: SubdomainEntry[],
    serverIp: string,
    certificateId: number,
  ): Promise<SubdomainSetupResult[]> {
    const created: Partial<SubdomainSetupResult>[] = [];

    try {
      const results: SubdomainSetupResult[] = [];

      for (const entry of entries) {
        const subdomain = `${name}${entry.suffix}`;
        const fullDomain = `${subdomain}.${this.config.baseDomain}`;

        // Create Cloudflare A record
        const cfResult = await this.cloudflare.createRecord(
          subdomain,
          serverIp,
          this.config.cloudflare.proxied,
        );

        created.push({
          subdomain,
          fullDomain,
          cloudflareId: cfResult.id,
          role: entry.role,
        });

        // Build proxy host config
        const proxyConfig: ProxyHostConfig = {
          domain_names: [fullDomain],
          forward_scheme: this.config.scheme,
          forward_host: serverIp,
          forward_port: entry.port,
          allow_websocket_upgrade: entry.websocket,
          certificate_id: certificateId,
          ssl_forced: true,
          http2_support: true,
          block_exploits: true,
          advanced_config: entry.role === "backend"
            ? this.config.npm.backendAdvancedConfig
            : "",
        };

        // Create NPM proxy host
        const npmResult = await this.npm.createProxyHost(proxyConfig);

        // Update the created entry with NPM proxy ID
        created[created.length - 1]!.npmProxyId = npmResult.id;

        results.push({
          subdomain,
          fullDomain,
          cloudflareId: cfResult.id,
          npmProxyId: npmResult.id,
          role: entry.role,
        });

        console.log(`[domain] Set up ${fullDomain} (${entry.role})`);
      }

      return results;
    } catch (error) {
      console.error("[domain] Setup failed, rolling back...", error);
      await this.rollback(created);
      throw error;
    }
  }

  async teardownDomains(records: SubdomainSetupResult[]): Promise<void> {
    for (const record of records) {
      try {
        await this.cloudflare.deleteRecord(record.cloudflareId);
        console.log(`[domain] Deleted CF record for ${record.fullDomain}`);
      } catch (error) {
        console.error(
          `[domain] Failed to delete CF record ${record.cloudflareId}:`,
          error,
        );
      }

      try {
        await this.npm.deleteProxyHost(record.npmProxyId);
        console.log(`[domain] Deleted NPM proxy for ${record.fullDomain}`);
      } catch (error) {
        console.error(
          `[domain] Failed to delete NPM proxy ${record.npmProxyId}:`,
          error,
        );
      }
    }
  }

  async verifyConnectivity(): Promise<{ cloudflare: boolean; npm: boolean }> {
    const [cloudflare, npm] = await Promise.all([
      this.cloudflare.verifyConnection(),
      this.npm
        .authenticate()
        .then(() => true)
        .catch(() => false),
    ]);

    return { cloudflare, npm };
  }

  private async rollback(
    created: Partial<SubdomainSetupResult>[],
  ): Promise<void> {
    for (const entry of created) {
      if (entry.cloudflareId) {
        try {
          await this.cloudflare.deleteRecord(entry.cloudflareId);
          console.log(
            `[domain] Rolled back CF record for ${entry.fullDomain}`,
          );
        } catch (error) {
          console.error(
            `[domain] Rollback failed for CF record ${entry.cloudflareId}:`,
            error,
          );
        }
      }

      if (entry.npmProxyId) {
        try {
          await this.npm.deleteProxyHost(entry.npmProxyId);
          console.log(
            `[domain] Rolled back NPM proxy for ${entry.fullDomain}`,
          );
        } catch (error) {
          console.error(
            `[domain] Rollback failed for NPM proxy ${entry.npmProxyId}:`,
            error,
          );
        }
      }
    }
  }
}
