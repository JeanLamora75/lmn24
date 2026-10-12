import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ParserModule } from "../parser/parser.module";
import { VideoFeedsController } from "./video-feeds.controller";
import { VideoFeedsService } from "./video-feeds.service";
import { YoutubeChannelDiscoveryService } from "./youtube-channel-discovery.service";
@Module({ imports: [AuthModule, ParserModule], controllers: [VideoFeedsController], providers: [VideoFeedsService, YoutubeChannelDiscoveryService] })
export class VideoFeedsModule {}
