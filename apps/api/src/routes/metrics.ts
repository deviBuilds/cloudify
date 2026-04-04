import { Router } from "express";
import si from "systeminformation";
import { listContainers, getContainerStats } from "@cloudify/docker-manager";

const router = Router();

// GET /infra/metrics/system
router.get("/metrics/system", async (_req, res) => {
  const [cpu, mem, disk, osInfo, load] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.osInfo(),
    si.currentLoad(),
  ]);

  const primaryDisk = disk[0] || { size: 0, used: 0, available: 0, use: 0 };

  res.json({
    cpu: {
      usage: Math.round(cpu.currentLoad * 100) / 100,
      cores: cpu.cpus.length,
    },
    memory: {
      total: mem.total,
      used: mem.active,
      free: mem.available,
      usagePercent: Math.round((mem.active / mem.total) * 10000) / 100,
    },
    disk: {
      total: primaryDisk.size,
      used: primaryDisk.used,
      free: primaryDisk.available,
      usagePercent: Math.round(primaryDisk.use * 100) / 100,
    },
    uptime: si.time().uptime,
    loadAvg: [load.avgLoad],
  });
});

// GET /infra/metrics/containers
router.get("/metrics/containers", async (_req, res) => {
  try {
    const containers = await listContainers({ all: true });

    const stats = await Promise.all(
      containers
        .filter((c) => c.State === "running")
        .map(async (c) => {
          try {
            const s = await getContainerStats(c.Id);
            return {
              id: c.Id.slice(0, 12),
              name: c.Names[0]?.replace(/^\//, "") ?? c.Id.slice(0, 12),
              image: c.Image,
              state: c.State,
              status: c.Status,
              ...s,
            };
          } catch {
            return {
              id: c.Id.slice(0, 12),
              name: c.Names[0]?.replace(/^\//, "") ?? c.Id.slice(0, 12),
              image: c.Image,
              state: c.State,
              status: c.Status,
              cpuPercent: 0,
              memUsage: 0,
              memLimit: 0,
              netInput: 0,
              netOutput: 0,
            };
          }
        })
    );

    // Also include stopped containers (without stats)
    const stoppedContainers = containers
      .filter((c) => c.State !== "running")
      .map((c) => ({
        id: c.Id.slice(0, 12),
        name: c.Names[0]?.replace(/^\//, "") ?? c.Id.slice(0, 12),
        image: c.Image,
        state: c.State,
        status: c.Status,
        cpuPercent: 0,
        memUsage: 0,
        memLimit: 0,
        netInput: 0,
        netOutput: 0,
      }));

    res.json([...stats, ...stoppedContainers]);
  } catch (error) {
    // Docker unavailable
    res.json([]);
  }
});

export default router;
