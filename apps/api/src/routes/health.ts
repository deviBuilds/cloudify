import { Router } from "express";
import { isDockerAvailable } from "@cloudify/docker-manager";

const router = Router();

router.get("/health", async (_req, res) => {
  const dockerOk = await isDockerAvailable();

  res.json({
    status: dockerOk ? "ok" : "degraded",
    version: "0.0.1",
    uptime: process.uptime(),
    docker: dockerOk,
  });
});

export default router;
