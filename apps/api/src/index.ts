import express from "express";
import cors from "cors";
import { getConfig } from "./config/index.js";
import { authMiddleware } from "./middleware/auth.js";
import healthRouter from "./routes/health.js";
import metricsRouter from "./routes/metrics.js";
import dnsRouter from "./routes/dns.js";
import proxyRouter from "./routes/proxy.js";
import statusRouter from "./routes/status.js";

const app = express();

app.use(cors());
app.use(express.json());

// Public routes (no auth)
app.use(healthRouter);

// Protected routes
app.use("/infra", authMiddleware);
app.use("/infra", metricsRouter);
app.use("/infra", dnsRouter);
app.use("/infra", proxyRouter);
app.use("/infra", statusRouter);

// Global error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[ERROR]", err.message);
    res.status(500).json({
      error: err.message || "Internal server error",
    });
  }
);

// Start
const config = getConfig();
const port = config.server.apiPort;

app.listen(port, config.server.host, () => {
  console.log(`[Cloudify API] Infra agent running on ${config.server.host}:${port}`);
  console.log(`[Cloudify API] Health: http://localhost:${port}/health`);
});

export default app;
