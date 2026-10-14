import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { HashtagMediaService } from "./hashtag-media.service";
import { HashtagMediaController } from "./hashtag-media.controller";
import { HashtagStatsService } from "./hashtag-stats.service";
import { HashtagHistoryService } from "./hashtag-history.service";
import { HashtagsController } from "./hashtags.controller";
import { HashtagsService } from "./hashtags.service";

@Module({
  imports: [AuthModule],
  controllers: [HashtagsController, HashtagMediaController],
  providers: [HashtagsService, HashtagMediaService, HashtagHistoryService, HashtagStatsService],
})
export class HashtagsModule {}
