import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { FeedCsvImportService } from "./feed-csv-import.service";
import { FeedsController } from "./feeds.controller";

@Module({
  imports: [AuthModule],
  controllers: [FeedsController],
  providers: [FeedCsvImportService],
})
export class FeedsModule {}
