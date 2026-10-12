import { BadRequestException, Controller, Get, Header, Query } from "@nestjs/common";
import { z } from "zod";
import { PublicVideosService } from "./public-videos.service";

const querySchema = z.object({
  locale: z.enum(["fr","en","de","es","pt","it","ru","nl"]),
  categoryId: z.string().uuid().optional(),
  sourceId: z.string().uuid().optional(),
  country: z.string().regex(/^[a-zA-Z]{2}$/).transform(x => x.toUpperCase()).optional(),
  cursor: z.string().min(1).max(256).optional(),
  limit: z.coerce.number().int().min(1).max(60).default(24),
}).strict();
@Controller("public/videos")
export class PublicVideosController {
  constructor(private readonly videos: PublicVideosService) {}
  @Get() @Header("Cache-Control", "no-store")
  async list(@Query() raw: Record<string,unknown>) {
    const parsed = querySchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException("Filtres vidéo invalides.");
    return this.videos.list(parsed.data);
  }
  @Get("filters") @Header("Cache-Control", "no-store")
  async filters(@Query("locale") raw: unknown) {
    const locale = z.enum(["fr","en","de","es","pt","it","ru","nl"]).safeParse(raw);
    if (!locale.success) throw new BadRequestException("Langue invalide.");
    return this.videos.filters(locale.data);
  }
}
