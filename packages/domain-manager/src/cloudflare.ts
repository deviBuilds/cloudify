import Cloudflare from "cloudflare";
import type { DNSRecord } from "./types.js";

export class CloudflareManager {
  private client: Cloudflare;
  private zoneId: string;

  constructor({ apiToken, zoneId }: { apiToken: string; zoneId: string }) {
    this.client = new Cloudflare({ apiToken });
    this.zoneId = zoneId;
  }

  async createRecord(
    subdomain: string,
    ip: string,
    proxied: boolean = true,
  ): Promise<{ id: string }> {
    const result = await this.client.dns.records.create({
      zone_id: this.zoneId,
      type: "A",
      name: subdomain,
      content: ip,
      proxied,
      ttl: 1,
    });

    return { id: result.id! };
  }

  async deleteRecord(recordId: string): Promise<void> {
    await this.client.dns.records.delete(recordId, {
      zone_id: this.zoneId,
    });
  }

  async listRecords(prefix?: string): Promise<DNSRecord[]> {
    const result = await this.client.dns.records.list({
      zone_id: this.zoneId,
    });

    const records = result.result ?? [];

    const mapped = records.map((r) => ({
      id: r.id!,
      name: r.name ?? "",
      type: r.type ?? "",
      content: r.content ?? "",
      proxied: r.proxied ?? false,
      ttl: r.ttl ?? 1,
    }));

    if (prefix) {
      return mapped.filter((r) => r.name.startsWith(prefix));
    }

    return mapped;
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.client.zones.get({ zone_id: this.zoneId });
      return true;
    } catch {
      return false;
    }
  }
}
