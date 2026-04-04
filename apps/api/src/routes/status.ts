import { Router } from "express";
import { NginxProxyManager } from "@cloudify/domain-manager";
import { getConfig } from "../config/index.js";

const router = Router();

// GET /infra/status — aggregated infrastructure connectivity status
router.get("/status", async (_req, res) => {
  const config = getConfig();

  const npm = new NginxProxyManager({
    url: config.nginxProxyManager.url,
    email: config.nginxProxyManager.email,
    password: config.nginxProxyManager.password,
  });

  const [npmResult] = await Promise.allSettled([
    npm.authenticate().then(() => true),
  ]);

  res.json({
    npm: {
      connected: npmResult.status === "fulfilled" && npmResult.value === true,
    },
    serverIp: config.server.serverIp,
  });
});

export default router;
