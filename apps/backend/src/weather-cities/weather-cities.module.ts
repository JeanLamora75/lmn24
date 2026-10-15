import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { WeatherCitiesController } from "./weather-cities.controller";
import { WeatherCitiesService } from "./weather-cities.service";

@Module({
  imports: [AuthModule],
  controllers: [WeatherCitiesController],
  providers: [WeatherCitiesService],
})
export class WeatherCitiesModule {}
