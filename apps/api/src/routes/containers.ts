import { Router } from "express";
import { listContainers, getContainerLogs } from "@cloudify/docker-manager";

const router = Router();

// GET /infra/containers — list containers, optional ?prefix= filter
router.get("/containers", async (req, res, next) => {
  try {
    const prefix = req.query.prefix as string | undefined;
    const containers = await listContainers({ all: true });

    const result = containers.map((c) => ({
      id: c.Id.slice(0, 12),
      name: c.Names[0]?.replace(/^\//, "") ?? c.Id.slice(0, 12),
      image: c.Image,
      state: c.State,
      status: c.Status,
      ports: c.Ports,
    }));

    if (prefix) {
      res.json(result.filter((c) => c.name.startsWith(prefix)));
    } else {
      res.json(result);
    }
  } catch (err) {
    next(err);
  }
});

// GET /infra/containers/:id/logs — get container logs
router.get("/containers/:id/logs", async (req, res, next) => {
  try {
    const tail = parseInt(req.query.tail as string) || 100;
    const logs = await getContainerLogs(req.params.id, { tail });
    res.json({ logs });
  } catch (err) {
    next(err);
  }
});

export default router;
