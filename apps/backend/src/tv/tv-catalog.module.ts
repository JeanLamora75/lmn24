import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TvCatalogController } from "./tv-catalog.controller";
import { TvCatalogService } from "./tv-catalog.service";
import { TvEpgSourcesController } from "./tv-epg-sources.controller";
import { TvEpgSourcesService } from "./tv-epg-sources.service";

@Module({
  imports: [AuthModule],
  controllers: [TvCatalogController, TvEpgSourcesController],
  providers: [TvCatalogService, TvEpgSourcesService],
})
export class TvCatalogModule {}
