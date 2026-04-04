import { Router } from "express";
import { CloudflareManager } from "@cloudify/domain-manager";
import { dnsCreateRequestSchema } from "@cloudify/shared";
import { validateBody } from "../middleware/validate.js";
import { getConfig } from "../config/index.js";

const router = Router();

function getCfClient() {
  const config = getConfig();
  return new CloudflareManager({
    apiToken: config.cloudflare.apiToken,
    zoneId: config.cloudflare.zoneId,
  });
}

/** Use per-request CF credentials if provided, else fall back to global config */
function getCfClientFromBody(body: Record<string, unknown>) {
  const token = body.cloudflareApiToken as string | undefined;
  const zone = body.cloudflareZoneId as string | undefined;
  if (token && zone) {
    return new CloudflareManager({ apiToken: token, zoneId: zone });
  }
  return getCfClient();
}

function getCfClientFromQuery(query: Record<string, unknown>) {
  const token = query.cloudflareApiToken as string | undefined;
  const zone = query.cloudflareZoneId as string | undefined;
  if (token && zone) {
    return new CloudflareManager({ apiToken: token, zoneId: zone });
  }
  return getCfClient();
}

// POST /infra/dns/create
router.post("/dns/create", validateBody(dnsCreateRequestSchema), async (req, res) => {
  const { subdomain, ip, proxied, baseDomain } = req.body;
  const cf = getCfClientFromBody(req.body);
  const config = getConfig();
  const domain = baseDomain || config.domain.baseDomain;

  const result = await cf.createRecord(subdomain, ip, proxied);
  res.json({
    id: result.id,
    name: `${subdomain}.${domain}`,
  });
});

// DELETE /infra/dns/:recordId
router.delete("/dns/:recordId", async (req, res) => {
  const cf = getCfClientFromQuery(req.query);
  await cf.deleteRecord(req.params.recordId);
  res.json({ ok: true });
});

// GET /infra/dns/list
router.get("/dns/list", async (req, res) => {
  const cf = getCfClientFromQuery(req.query);
  const prefix = req.query.prefix as string | undefined;
  const records = await cf.listRecords(prefix);
  res.json(records);
});

// GET /infra/dns/verify
router.get("/dns/verify", async (req, res) => {
  const cf = getCfClientFromQuery(req.query);
  const connected = await cf.verifyConnection();
  res.json({ connected });
});

export default router;
