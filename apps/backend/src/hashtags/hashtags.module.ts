import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { HashtagsController } from "./hashtags.controller";
import { HashtagsService } from "./hashtags.service";

@Module({
  imports: [AuthModule],
  controllers: [HashtagsController],
  providers: [HashtagsService],
})
export class HashtagsModule {}
