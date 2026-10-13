import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { HashtagMediaService } from "./hashtag-media.service";
import { HashtagMediaController } from "./hashtag-media.controller";
import { HashtagsController } from "./hashtags.controller";
import { HashtagsService } from "./hashtags.service";

@Module({
  imports: [AuthModule],
  controllers: [HashtagsController, HashtagMediaController],
  providers: [HashtagsService, HashtagMediaService],
})
export class HashtagsModule {}
