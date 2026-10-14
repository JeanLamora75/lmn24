import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ManualPurgeController } from "./manual-purge.controller";
import { ManualPurgeService } from "./manual-purge.service";
import { RetentionSettingsController } from "./retention-settings.controller";
import { RetentionSettingsService } from "./retention-settings.service";

@Module({
  imports: [AuthModule],
  controllers: [RetentionSettingsController, ManualPurgeController],
  providers: [RetentionSettingsService, ManualPurgeService],
})
export class RetentionSettingsModule {}
