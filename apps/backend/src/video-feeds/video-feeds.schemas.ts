import { z } from "zod";

export const videoFeedIdSchema = z.string().uuid();
export const videoFeedListSchema = z.object({
  search: z.string().trim().max(255).optional(),
  sourceId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  language: z.string().regex(/^[A-Za-z]{2}$/).transform(x => x.toLowerCase()).optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().refine(x => [5, 10, 25, 50, 100].includes(x)).default(10),
});
export const videoFeedInputSchema = z.object({
  sourceId: z.string().uuid(),
  categoryId: z.string().uuid(),
  languageIsoCode2: z.string().regex(/^[A-Za-z]{2}$/).transform(x => x.toLowerCase()),
  channelId: z.string().trim().regex(/^UC[A-Za-z0-9_-]{22}$/, "Identifiant YouTube channel_id invalide."),
  feedUrl: z.url().max(2048),
  isActive: z.boolean(),
}).superRefine((input, ctx) => {
  try {
    const url = new URL(input.feedUrl);
    if (url.protocol !== "https:" || url.hostname !== "www.youtube.com" ||
      url.pathname !== "/feeds/videos.xml" ||
      url.searchParams.get("channel_id") !== input.channelId ||
      [...url.searchParams.keys()].some(key => key !== "channel_id")) {
      ctx.addIssue({ code: "custom", path: ["feedUrl"], message: "Le flux doit correspondre à l'URL Atom de la chaîne YouTube." });
    }
  } catch {
    ctx.addIssue({ code: "custom", path: ["feedUrl"], message: "URL Atom YouTube invalide." });
  }
});
export const videoFeedStatusSchema = z.object({ isActive: z.boolean() });
export type VideoFeedInput = z.infer<typeof videoFeedInputSchema>;
export type VideoFeedList = z.infer<typeof videoFeedListSchema>;
