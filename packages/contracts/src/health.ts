import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.enum(["ok", "error"]),
  service: z.enum(["backend", "parser"]),
  database: z.enum(["up", "down"]).optional(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
