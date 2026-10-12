import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { VideosController } from "./videos.controller";
import { VideosService } from "./videos.service";

@Module({ imports: [AuthModule], controllers: [VideosController], providers: [VideosService] })
export class VideosModule {}
