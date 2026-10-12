import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ParserModule } from "../parser/parser.module";
import { VideoFeedsController } from "./video-feeds.controller";
import { VideoFeedsService } from "./video-feeds.service";
@Module({ imports: [AuthModule], controllers: [VideoFeedsController], providers: [VideoFeedsService] })
export class VideoFeedsModule {}
