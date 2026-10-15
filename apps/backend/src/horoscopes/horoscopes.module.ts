import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PublicHoroscopesController } from "./public-horoscopes.controller";
import { PublicHoroscopesService } from "./public-horoscopes.service";
import { HoroscopeImportController } from "./horoscope-import.controller";
import { HoroscopeImportService } from "./horoscope-import.service";

@Module({
  imports: [AuthModule],
  controllers: [PublicHoroscopesController, HoroscopeImportController],
  providers: [PublicHoroscopesService, HoroscopeImportService],
})
export class HoroscopesModule {}
