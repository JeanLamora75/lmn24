import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HashtagMediaService, validatePublicImageUrl } from "./hashtag-media.service";

let temp: string;
let service: HashtagMediaService;

beforeEach(async () => {
  temp = await mkdtemp(join(tmpdir(), "lmn24-hashtag-test-"));
  service = new HashtagMediaService({
    get: vi.fn().mockReturnValue(temp),
  } as unknown as ConfigService);
});
afterEach(async () => { await rm(temp, { recursive: true, force: true }); });

describe("SCRUM-50 — Hashtag images", () => {
  it("converts PNG to valid, resized WebP and serves the saved bytes", async () => {
    const input = await sharp({
      create: { width: 1400, height: 900, channels: 3, background: "#3567a7" },
    }).png().toBuffer();
    const url = await service.storeImage(input);
    expect(url).toMatch(/^\/api\/media\/hashtags\/[0-9a-f-]{36}\.webp$/);
    const bytes = await service.readImage(url.split("/").at(-1)!);
    const metadata = await sharp(bytes).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBeLessThanOrEqual(1200);
    expect(metadata.height).toBeLessThanOrEqual(675);
    await service.deleteLocalImage(url);
    await expect(service.readImage(url.split("/").at(-1)!)).rejects.toThrow(NotFoundException);
  });

  it("rejects fake JPEG, unsupported SVG and oversized bytes", async () => {
    await expect(service.storeImage(Buffer.from("<html>not an image</html>")))
      .rejects.toThrow(BadRequestException);
    await expect(service.storeImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')))
      .rejects.toThrow(BadRequestException);
    await expect(service.storeImage(Buffer.alloc(8 * 1024 * 1024 + 1)))
      .rejects.toThrow(BadRequestException);
  });

  it("rejects traversal-like filenames and unmanaged paths", async () => {
    await expect(service.readImage("../secret.webp")).rejects.toThrow(NotFoundException);
    expect(service.isManagedImage("/source-media/abc.jpg")).toBe(false);
  });
});

describe("SCRUM-50 — secure image URL rules", () => {
  it.each([
    "http://example.org/photo.jpg",
    "https://localhost/photo.png",
    "https://169.254.169.254/latest/meta-data",
    "https://127.0.0.1/test.png",
    "https://10.0.0.1/private.png",
    "https://192.168.1.9/internal.png",
    "https://[::1]/test.png",
    "https://user:pass@example.org/a.png",
    "https://example.org:8080/a.jpg",
  ])("rejects unsafe URLs: %s", (raw) => {
    expect(() => validatePublicImageUrl(raw)).toThrow(BadRequestException);
  });
  it("accepts public HTTPS URLs for server-side checks", () => {
    expect(validatePublicImageUrl("https://upload.wikimedia.org/example.jpg").hostname)
      .toBe("upload.wikimedia.org");
  });
});
