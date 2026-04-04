import { Router } from "express";
import {
  writeComposeFile,
  composeUp,
  composeDown,
  composeStop,
  composeRestart,
} from "@cloudify/docker-manager";
import {
  composeWriteRequestSchema,
  composeUpRequestSchema,
  composeDownRequestSchema,
} from "@cloudify/shared";
import { validateBody } from "../middleware/validate.js";

const router = Router();

// POST /infra/compose/write — write docker-compose.yml + optional .env
router.post(
  "/compose/write",
  validateBody(composeWriteRequestSchema),
  async (req, res, next) => {
    try {
      const { dir, compose, envVars } = req.body;
      writeComposeFile(dir, compose, envVars);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

// POST /infra/compose/up — docker compose up -d
router.post(
  "/compose/up",
  validateBody(composeUpRequestSchema),
  async (req, res, next) => {
    try {
      await composeUp(req.body.dir);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

// POST /infra/compose/down — docker compose down (optional -v)
router.post(
  "/compose/down",
  validateBody(composeDownRequestSchema),
  async (req, res, next) => {
    try {
      await composeDown(req.body.dir, req.body.removeVolumes);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

// POST /infra/compose/stop — docker compose stop
router.post("/compose/stop", validateBody(composeUpRequestSchema), async (req, res, next) => {
  try {
    await composeStop(req.body.dir);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /infra/compose/restart — docker compose restart
router.post("/compose/restart", validateBody(composeUpRequestSchema), async (req, res, next) => {
  try {
    await composeRestart(req.body.dir);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
