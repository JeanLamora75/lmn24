import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SchedulerSettingsController } from "./scheduler-settings.controller";

@Module({
  imports: [AuthModule],
  controllers: [SchedulerSettingsController],
})
export class SchedulerSettingsModule {}
