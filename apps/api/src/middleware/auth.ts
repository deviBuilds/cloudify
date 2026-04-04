import type { Request, Response, NextFunction } from "express";

const INFRA_AGENT_SECRET = process.env.INFRA_AGENT_SECRET;

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!INFRA_AGENT_SECRET) {
    res.status(500).json({ error: "INFRA_AGENT_SECRET not configured" });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  if (token !== INFRA_AGENT_SECRET) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  next();
}
