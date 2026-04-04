import { Router } from "express";
import { execSync } from "node:child_process";
import { NginxProxyManager, discoverWildcardCert } from "@cloudify/domain-manager";
import type { ProxyHostConfig } from "@cloudify/domain-manager";
import { proxyCreateRequestSchema } from "@cloudify/shared";
import { validateBody } from "../middleware/validate.js";
import { getConfig } from "../config/index.js";

const router = Router();

let cachedDockerGateway: string | null = null;

function getDockerBridgeGateway(): string {
  if (cachedDockerGateway) return cachedDockerGateway;
  try {
    const output = execSync(
      "docker network inspect bridge --format '{{(index .IPAM.Config 0).Gateway}}'",
      { encoding: "utf-8" }
    ).trim();
    if (output) {
      cachedDockerGateway = output;
      console.log(`[proxy] Docker bridge gateway: ${output}`);
      return output;
    }
  } catch {
    console.warn("[proxy] Failed to detect Docker bridge gateway, falling back to 172.17.0.1");
  }
  cachedDockerGateway = "172.17.0.1";
  return cachedDockerGateway;
}

function getNpmClient() {
  const config = getConfig();
  return new NginxProxyManager({
    url: config.nginxProxyManager.url,
    email: config.nginxProxyManager.email,
    password: config.nginxProxyManager.password,
  });
}

// POST /infra/proxy/create
router.post("/proxy/create", validateBody(proxyCreateRequestSchema), async (req, res) => {
  const { domainNames, forwardPort, websocket, certificateId, advancedConfig } = req.body;
  const npm = getNpmClient();

  const proxyConfig: ProxyHostConfig = {
    domain_names: domainNames,
    forward_scheme: "http",
    forward_host: getDockerBridgeGateway(),
    forward_port: forwardPort,
    allow_websocket_upgrade: websocket ?? false,
    certificate_id: certificateId,
    ssl_forced: false,
    http2_support: true,
    block_exploits: true,
    advanced_config: advancedConfig ?? "",
  };

  const result = await npm.createProxyHost(proxyConfig);
  res.json({ id: result.id });
});

// DELETE /infra/proxy/:id
router.delete("/proxy/:id", async (req, res) => {
  const npm = getNpmClient();
  await npm.deleteProxyHost(Number(req.params.id));
  res.json({ ok: true });
});

// GET /infra/proxy/list
router.get("/proxy/list", async (_req, res) => {
  const npm = getNpmClient();
  const hosts = await npm.listProxyHosts();
  res.json(hosts);
});

// GET /infra/proxy/cert
router.get("/proxy/cert", async (req, res) => {
  const npm = getNpmClient();
  const config = getConfig();
  const domain = (req.query.domain as string) || config.nginxProxyManager.wildcardCertDomain;
  const certId = await discoverWildcardCert(npm, domain);
  res.json({ certId, domain });
});

// GET /infra/proxy/verify
router.get("/proxy/verify", async (_req, res) => {
  const npm = getNpmClient();
  try {
    await npm.authenticate();
    res.json({ connected: true });
  } catch (err) {
    res.json({ connected: false, error: err instanceof Error ? err.message : "Unknown error" });
  }
});

export default router;
