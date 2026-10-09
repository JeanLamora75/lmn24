import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Query,
} from "@nestjs/common";
import { z } from "zod";

import { PublicHomeService } from "./public-home.service";

// Identiques aux préfixes de langue autorisés par next-intl.
const localeSchema = z.enum(["fr", "en", "de", "es", "pt", "it", "ru"]);

@Controller("public/home")
export class PublicHomeController {
  constructor(private readonly homeService: PublicHomeService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  async getHome(@Query("locale") locale: unknown) {
    const parsed = localeSchema.safeParse(locale);
    if (!parsed.success) {
      throw new BadRequestException("Langue de consultation invalide.");
    }

    return this.homeService.getHome(parsed.data);
  }
}
