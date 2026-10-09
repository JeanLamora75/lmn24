import { Controller, Get, Header } from "@nestjs/common";

import { CategoriesService } from "./categories.service";

@Controller("public/home")
export class PublicHomeCategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get("categories")
  @Header("Cache-Control", "no-store")
  async list() {
    return {
      items: await this.categoriesService.listPublicHomeCategories(),
    };
  }
}
