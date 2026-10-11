import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";
import { PublicCategoryController } from "./public-category.controller";
import { PublicCategoryService } from "./public-category.service";
import { PublicHomeCategoriesController } from "./public-home-categories.controller";
import { PublicHomeController } from "./public-home.controller";
import { PublicHomeService } from "./public-home.service";
import { PublicSourceController } from "./public-source.controller";
import { PublicSourceService } from "./public-source.service";

@Module({
  imports: [AuthModule],
  controllers: [
    CategoriesController,
    PublicHomeCategoriesController,
    PublicHomeController,
    PublicCategoryController,
    PublicSourceController,
  ],
  providers: [CategoriesService, PublicHomeService, PublicCategoryService, PublicSourceService],
})
export class CategoriesModule {}
