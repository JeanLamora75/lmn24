import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";

import { AuthModule } from "./auth/auth.module";
import { CategoriesModule } from "./categories/categories.module";
import { DatabaseModule } from "./database/database.module";
import { FeedsModule } from "./feeds/feeds.module";
import { HealthController } from "./health.controller";
import { ParserModule } from "./parser/parser.module";
import { SourcesModule } from "./sources/sources.module";
import { StatisticsModule } from "./statistics/statistics.module";

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
    ParserModule,
    StatisticsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
