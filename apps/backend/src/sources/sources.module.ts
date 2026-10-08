import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { SourceCaptureService } from "./source-capture.service";
import { SourceMediaController } from "./source-media.controller";
import { SourceMediaService } from "./source-media.service";
import { SourcesController } from "./sources.controller";
import { SourcesService } from "./sources.service";

@Module({
  imports: [AuthModule],
  controllers: [SourcesController, SourceMediaController],
  providers: [
    SourcesService,
    SourceMediaService,
    SourceCaptureService,
  ],
})
export class SourcesModule {}
