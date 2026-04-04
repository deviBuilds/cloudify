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

// POST /infra/dns/create
router.post("/dns/create", validateBody(dnsCreateRequestSchema), async (req, res) => {
  const { subdomain, ip, proxied } = req.body;
  const cf = getCfClient();
  const config = getConfig();

  const result = await cf.createRecord(subdomain, ip, proxied);
  res.json({
    id: result.id,
    name: `${subdomain}.${config.domain.baseDomain}`,
  });
});

// DELETE /infra/dns/:recordId
router.delete("/dns/:recordId", async (req, res) => {
  const cf = getCfClient();
  await cf.deleteRecord(req.params.recordId);
  res.json({ ok: true });
});

// GET /infra/dns/list
router.get("/dns/list", async (req, res) => {
  const cf = getCfClient();
  const prefix = req.query.prefix as string | undefined;
  const records = await cf.listRecords(prefix);
  res.json(records);
});

// GET /infra/dns/verify
router.get("/dns/verify", async (_req, res) => {
  const cf = getCfClient();
  const connected = await cf.verifyConnection();
  res.json({ connected });
});

export default router;
