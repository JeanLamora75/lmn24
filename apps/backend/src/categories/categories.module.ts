import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";
import { PublicHomeCategoriesController } from "./public-home-categories.controller";
import { PublicHomeController } from "./public-home.controller";
import { PublicHomeService } from "./public-home.service";

@Module({
  imports: [AuthModule],
  controllers: [CategoriesController, PublicHomeCategoriesController, PublicHomeController],
  providers: [CategoriesService, PublicHomeService],
})
export class CategoriesModule {}
