import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";
import { PublicCategoryController } from "./public-category.controller";
import { PublicCategoryService } from "./public-category.service";
import { PublicHomeCategoriesController } from "./public-home-categories.controller";
import { PublicHomeController } from "./public-home.controller";
import { PublicHomeService } from "./public-home.service";

@Module({
  imports: [AuthModule],
  controllers: [
    CategoriesController,
    PublicHomeCategoriesController,
    PublicHomeController,
    PublicCategoryController,
  ],
  providers: [CategoriesService, PublicHomeService, PublicCategoryService],
})
export class CategoriesModule {}
