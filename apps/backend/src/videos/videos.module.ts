import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { VideosController } from "./videos.controller";
import { PublicVideosController } from "./public-videos.controller";
import { PublicVideosService } from "./public-videos.service";
import { VideosService } from "./videos.service";

@Module({ imports: [AuthModule], controllers: [VideosController, PublicVideosController], providers: [VideosService, PublicVideosService] })
export class VideosModule {}
