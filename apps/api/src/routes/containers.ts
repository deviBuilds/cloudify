import { Router } from "express";
import { listContainers, getContainerLogs, streamContainerLogs, getDockerClient } from "@cloudify/docker-manager";

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

// GET /infra/containers/:id/logs/stream — SSE log stream
router.get("/containers/:id/logs/stream", async (req, res, next) => {
  try {
    const tail = parseInt(req.query.tail as string) || 100;

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const stream = await streamContainerLogs(req.params.id, { tail });

    // Dockerode returns a multiplexed stream with 8-byte headers per frame
    const { PassThrough } = await import("stream");
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const docker = getDockerClient();
    docker.modem.demuxStream(stream, stdout, stderr);

    const sendLine = (line: string) => {
      if (line.trim()) {
        res.write(`data: ${JSON.stringify(line)}\n\n`);
      }
    };

    let buffer = "";
    const processChunk = (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      lines.forEach(sendLine);
    };

    stdout.on("data", processChunk);
    stderr.on("data", processChunk);

    // Heartbeat every 15s
    const heartbeat = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 15000);

    // Cleanup
    const cleanup = () => {
      clearInterval(heartbeat);
      (stream as any).destroy?.();
      stdout.destroy();
      stderr.destroy();
    };

    (stream as NodeJS.ReadableStream).on("end", () => {
      res.write("event: end\ndata: stream ended\n\n");
      cleanup();
      res.end();
    });

    req.on("close", cleanup);
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
