import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TvCatalogController } from "./tv-catalog.controller";
import { TvCatalogService } from "./tv-catalog.service";
import { TvEpgSourcesController } from "./tv-epg-sources.controller";
import { TvEpgSourcesService } from "./tv-epg-sources.service";
import { TvImportRunsController } from "./tv-import-runs.controller";
import { TvImportRunsService } from "./tv-import-runs.service";
import { TvImportScheduler } from "./tv-import-scheduler";
import { TvPublicController } from "./tv-public.controller";
import { TvPublicService } from "./tv-public.service";

@Module({
  imports: [AuthModule],
  controllers: [TvCatalogController, TvEpgSourcesController, TvImportRunsController, TvPublicController],
  providers: [TvCatalogService, TvEpgSourcesService, TvImportRunsService, TvImportScheduler, TvPublicService],
})
export class TvCatalogModule {}
