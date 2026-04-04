import type { ServiceType, DeploymentStatus } from "../constants.js";

export interface Deployment {
  _id: string;
  name: string;
  serviceType: ServiceType;
  status: DeploymentStatus;
  containerPrefix: string;
  config: Record<string, unknown>;
  portMappings: Record<string, number>;
  domainUrls?: Record<string, string>;
  deletedAt?: number;
  _creationTime: number;
}

export interface DeploymentWithDns extends Deployment {
  dnsRecords: DnsRecordInfo[];
}

export interface DnsRecordInfo {
  _id: string;
  subdomain: string;
  fullDomain: string;
  recordType: string;
  cloudflareId?: string;
  npmProxyId?: number;
  serviceRole: string;
  targetPort: number;
  websocket: boolean;
  proxied: boolean;
}

export interface CredentialInfo {
  _id: string;
  deploymentId: string;
  keyType: string;
  keyValue: string;
  rotatedAt?: number;
}

export interface PortAllocation {
  _id: string;
  deploymentId: string;
  port: number;
  role: string;
}
