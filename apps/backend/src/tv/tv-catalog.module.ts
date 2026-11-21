import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TvCatalogController } from "./tv-catalog.controller";
import { TvCatalogService } from "./tv-catalog.service";
import { TvEpgSourcesController } from "./tv-epg-sources.controller";
import { TvEpgSourcesService } from "./tv-epg-sources.service";
import { TvImportRunsController } from "./tv-import-runs.controller";
import { TvImportRunsService } from "./tv-import-runs.service";
import { TvImportScheduler } from "./tv-import-scheduler";
import { TvTranslationAdminController } from "./tv-translation-admin.controller";
import { TvTranslationAdminService } from "./tv-translation-admin.service";
import { TvTranslationWorkflowService } from "./tv-translation-workflow.service";
import { TvPublicController } from "./tv-public.controller";
import { TvPublicService } from "./tv-public.service";

@Module({
  imports: [AuthModule],
  controllers: [TvCatalogController, TvEpgSourcesController, TvImportRunsController, TvTranslationAdminController, TvPublicController],
  providers: [TvCatalogService, TvEpgSourcesService, TvImportRunsService, TvImportScheduler, TvTranslationAdminService, TvTranslationWorkflowService, TvPublicService],
})
export class TvCatalogModule {}
