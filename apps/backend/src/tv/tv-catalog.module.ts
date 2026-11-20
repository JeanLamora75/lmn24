import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TvCatalogController } from "./tv-catalog.controller";
import { TvCatalogService } from "./tv-catalog.service";

@Module({
  imports: [AuthModule],
  controllers: [TvCatalogController],
  providers: [TvCatalogService],
})
export class TvCatalogModule {}
