import {
  Controller,
  Get,
  Header,
  Param,
  StreamableFile,
} from "@nestjs/common";

import { SourceMediaService } from "./source-media.service";

@Controller("media/sources")
export class SourceMediaController {
  constructor(private readonly media: SourceMediaService) {}

  @Get(":filename")
  @Header("Cache-Control", "public, max-age=86400")
  async image(@Param("filename") filename: string) {
    const image = await this.media.readImage(filename);

    return new StreamableFile(image.buffer, {
      type: image.contentType,
    });
  }
}
