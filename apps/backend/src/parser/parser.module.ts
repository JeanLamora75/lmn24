import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { ParserMonitoringController } from "./parser-monitoring.controller";
import { ParserMonitoringService } from "./parser-monitoring.service";
import { WeatherMonitoringService } from "./weather-monitoring.service";
import { ParserController } from "./parser.controller";
import { ParserGatewayService } from "./parser-gateway.service";

@Module({
  imports: [AuthModule],
  controllers: [ParserController, ParserMonitoringController],
  providers: [ParserGatewayService, ParserMonitoringService, WeatherMonitoringService],
  exports: [ParserGatewayService],
})
export class ParserModule {}
