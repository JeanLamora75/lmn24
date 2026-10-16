import { Module } from "@nestjs/common";
import { PublicWeatherController } from "./public-weather.controller";
import { PublicWeatherService } from "./public-weather.service";

@Module({
  controllers: [PublicWeatherController],
  providers: [PublicWeatherService],
})
export class PublicWeatherModule {}
