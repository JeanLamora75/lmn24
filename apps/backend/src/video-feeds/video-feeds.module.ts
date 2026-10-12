import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { VideoFeedsController } from "./video-feeds.controller";
import { VideoFeedsService } from "./video-feeds.service";
@Module({ imports: [AuthModule], controllers: [VideoFeedsController], providers: [VideoFeedsService] })
export class VideoFeedsModule {}
