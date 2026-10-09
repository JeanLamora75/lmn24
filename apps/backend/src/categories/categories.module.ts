import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";
import { PublicHomeCategoriesController } from "./public-home-categories.controller";

@Module({
  imports: [AuthModule],
  controllers: [CategoriesController, PublicHomeCategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
