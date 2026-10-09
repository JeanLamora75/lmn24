import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { FeedCsvImportService } from "./feed-csv-import.service";
import { FeedsController } from "./feeds.controller";
import { FeedsService } from "./feeds.service";

@Module({
  imports: [AuthModule],
  controllers: [FeedsController],
  providers: [FeedCsvImportService, FeedsService],
})
export class FeedsModule {}
