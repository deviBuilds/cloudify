import { Router } from "express";
import { execInContainer } from "@cloudify/docker-manager";
import { credentialsGenerateRequestSchema } from "@cloudify/shared";
import { validateBody } from "../middleware/validate.js";

const router = Router();

// POST /infra/credentials/generate — run generate_admin_key.sh in a container
router.post(
  "/credentials/generate",
  validateBody(credentialsGenerateRequestSchema),
  async (req, res, next) => {
    try {
      const { containerName } = req.body;
      const output = await execInContainer(containerName, [
        "./generate_admin_key.sh",
      ]);
      const adminKey = output.trim();
      if (!adminKey) {
        res.status(500).json({ error: "Admin key generation returned empty output" });
        return;
      }
      res.json({ adminKey });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
