import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { HashtagMediaService } from "./hashtag-media.service";
import { HashtagMediaController } from "./hashtag-media.controller";
import { HashtagStatsService } from "./hashtag-stats.service";
import { HashtagTrendsService } from "./hashtag-trends.service";
import { HashtagTrendSettingsController } from "./hashtag-trend-settings.controller";
import { HashtagRankingsController } from "./hashtag-rankings.controller";
import { PublicHashtagArticlesController } from "./public-hashtag-articles.controller";
import { PublicHashtagArticlesService } from "./public-hashtag-articles.service";
import { HashtagHistoryService } from "./hashtag-history.service";
import { HashtagsController } from "./hashtags.controller";
import { HashtagsService } from "./hashtags.service";

@Module({
  imports: [AuthModule],
  controllers: [HashtagsController, HashtagMediaController, HashtagTrendSettingsController, HashtagRankingsController, PublicHashtagArticlesController],
  providers: [HashtagsService, HashtagMediaService, HashtagHistoryService, HashtagStatsService, HashtagTrendsService, PublicHashtagArticlesService],
})
export class HashtagsModule {}
