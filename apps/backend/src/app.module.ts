import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";

import { AuthModule } from "./auth/auth.module";
import { CategoriesModule } from "./categories/categories.module";
import { DatabaseModule } from "./database/database.module";
import { FeedsModule } from "./feeds/feeds.module";
import { HealthController } from "./health.controller";\nimport { ParserModule } from "./parser/parser.module";
import { SourcesModule } from "./sources/sources.module";

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
  ],
  controllers: [HealthController],
})
export class AppModule {}
