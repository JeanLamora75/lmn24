import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RetentionSettingsController } from "./retention-settings.controller";
import { RetentionSettingsService } from "./retention-settings.service";

@Module({
  imports: [AuthModule],
  controllers: [RetentionSettingsController],
  providers: [RetentionSettingsService],
})
export class RetentionSettingsModule {}
