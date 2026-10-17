import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PublicHoroscopesController } from "./public-horoscopes.controller";
import { PublicHoroscopesService } from "./public-horoscopes.service";
import { HoroscopeSchedulerController } from "./horoscope-scheduler.controller";
import { HoroscopeImportController } from "./horoscope-import.controller";
import { HoroscopeImportService } from "./horoscope-import.service";

@Module({
  imports: [AuthModule],
  controllers: [PublicHoroscopesController, HoroscopeImportController, HoroscopeSchedulerController],
  providers: [PublicHoroscopesService, HoroscopeImportService],
})
export class HoroscopesModule {}
