import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";

import { AuthModule } from "./auth/auth.module";
import { CategoriesModule } from "./categories/categories.module";
import { DatabaseModule } from "./database/database.module";
import { FeedsModule } from "./feeds/feeds.module";
import { HashtagsModule } from "./hashtags/hashtags.module";
import { HealthController } from "./health.controller";
import { HoroscopesModule } from "./horoscopes/horoscopes.module";
import { ParserModule } from "./parser/parser.module";
import { RetentionSettingsModule } from "./retention/retention-settings.module";
import { SourcesModule } from "./sources/sources.module";
import { StatisticsModule } from "./statistics/statistics.module";
import { VideoFeedsModule } from "./video-feeds/video-feeds.module";
import { VideosModule } from "./videos/videos.module";
import { WeatherCitiesModule } from "./weather-cities/weather-cities.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"],
    }),
    LoggerModule.forRoot(),
    DatabaseModule,
    AuthModule,
    SourcesModule,
    FeedsModule,
    CategoriesModule,
    HashtagsModule,
    HoroscopesModule,
    ParserModule,
    RetentionSettingsModule,
    StatisticsModule,
    VideoFeedsModule,
    VideosModule,
    WeatherCitiesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
