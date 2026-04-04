import { z } from "zod";

export const deploymentNameSchema = z
  .string()
  .min(3, "Name must be at least 3 characters")
  .max(63, "Name must be at most 63 characters")
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    "Name must be lowercase alphanumeric with hyphens, cannot start or end with hyphen"
  );

export const createDeploymentSchema = z.object({
  name: deploymentNameSchema,
  serviceType: z.enum(["convex", "postgres", "spacetimedb"]),
  portOverrides: z
    .object({
      postgres: z.number().optional(),
      backend: z.number().optional(),
      site: z.number().optional(),
      dashboard: z.number().optional(),
    })
    .optional(),
});

export const updateDeploymentStatusSchema = z.object({
  id: z.string(),
  status: z.enum(["creating", "running", "stopped", "error", "degraded"]),
});

export const portMappingsSchema = z.record(
  z.string(),
  z.number()
);

export type CreateDeploymentInput = z.infer<typeof createDeploymentSchema>;
export type UpdateDeploymentStatusInput = z.infer<typeof updateDeploymentStatusSchema>;
export type PortMappings = z.infer<typeof portMappingsSchema>;
