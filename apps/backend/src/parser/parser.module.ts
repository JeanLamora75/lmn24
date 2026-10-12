import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { ParserController } from "./parser.controller";
import { ParserGatewayService } from "./parser-gateway.service";

@Module({
  imports: [AuthModule],
  controllers: [ParserController],
  providers: [ParserGatewayService],
  exports: [ParserGatewayService],
})
export class ParserModule {}
