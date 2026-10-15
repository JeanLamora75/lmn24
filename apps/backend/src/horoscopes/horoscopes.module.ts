import { Module } from "@nestjs/common";
import { PublicHoroscopesController } from "./public-horoscopes.controller";
import { PublicHoroscopesService } from "./public-horoscopes.service";

@Module({
  controllers: [PublicHoroscopesController],
  providers: [PublicHoroscopesService],
})
export class HoroscopesModule {}
