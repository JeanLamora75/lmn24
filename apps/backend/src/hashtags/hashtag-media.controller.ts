import { Controller, Get, Header, Param, StreamableFile } from "@nestjs/common";
import { HashtagMediaService } from "./hashtag-media.service";

@Controller("media/hashtags")
export class HashtagMediaController {
  constructor(private readonly media: HashtagMediaService) {}

  @Get(":filename")
  @Header("Cache-Control", "public, max-age=86400, immutable")
  @Header("X-Content-Type-Options", "nosniff")
  async image(@Param("filename") filename: string) {
    const buffer = await this.media.readImage(filename);
    return new StreamableFile(buffer, { type: "image/webp" });
  }
}
