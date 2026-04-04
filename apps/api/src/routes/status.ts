import { Router } from "express";
import { CloudflareManager, NginxProxyManager, discoverWildcardCert } from "@cloudify/domain-manager";
import { getConfig } from "../config/index.js";

const router = Router();

// GET /infra/status — aggregated infrastructure connectivity status
router.get("/status", async (_req, res) => {
  const config = getConfig();

  const cf = new CloudflareManager({
    apiToken: config.cloudflare.apiToken,
    zoneId: config.cloudflare.zoneId,
  });
  const npm = new NginxProxyManager({
    url: config.nginxProxyManager.url,
    email: config.nginxProxyManager.email,
    password: config.nginxProxyManager.password,
  });

  const [cfResult, npmResult, certResult, recordsResult] = await Promise.allSettled([
    cf.verifyConnection(),
    npm.authenticate().then(() => true),
    discoverWildcardCert(npm, config.nginxProxyManager.wildcardCertDomain),
    cf.listRecords(),
  ]);

  res.json({
    cloudflare: {
      connected: cfResult.status === "fulfilled" && cfResult.value === true,
    },
    npm: {
      connected: npmResult.status === "fulfilled" && npmResult.value === true,
    },
    wildcardCert: {
      found: certResult.status === "fulfilled" && certResult.value !== null,
      id: certResult.status === "fulfilled" ? certResult.value : null,
      domain: config.nginxProxyManager.wildcardCertDomain,
    },
    dnsRecords: {
      total: recordsResult.status === "fulfilled" ? recordsResult.value.length : 0,
    },
    baseDomain: config.domain.baseDomain,
  });
});

export default router;
