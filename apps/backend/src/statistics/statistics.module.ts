import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { HashtagsModule } from "../hashtags/hashtags.module";
import { HashtagStatisticsController } from "./hashtag-statistics.controller";
import { HashtagStatisticsService } from "./hashtag-statistics.service";
import { StatisticsController } from "./statistics.controller";
import { StatisticsService } from "./statistics.service";

@Module({
  imports: [AuthModule, HashtagsModule],
  controllers: [StatisticsController, HashtagStatisticsController],
  providers: [StatisticsService, HashtagStatisticsService],
})
export class StatisticsModule {}
