import { z } from "zod";

export const apiErrorResponseSchema = z.object({
  statusCode: z.number().int(),
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.iso.datetime(),
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
