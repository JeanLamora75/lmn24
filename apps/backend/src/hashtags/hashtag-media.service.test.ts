import {
  BadGatewayException, BadRequestException, GatewayTimeoutException,
  NotFoundException, ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HashtagMediaService, imageDownloadError, normalizeImageSourceUrl,
  validatePublicImageUrl,
} from "./hashtag-media.service";

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

describe("Image URL import — regression: never return raw Internal error", () => {
  it("accepts a Wikimedia Commons file page and converts it into the direct-image redirect", () => {
    const url = normalizeImageSourceUrl(
      "https://commons.wikimedia.org/wiki/File:Example_image_2026.jpg",
    );
    expect(url.toString()).toBe(
      "https://commons.wikimedia.org/wiki/Special:FilePath/Example_image_2026.jpg",
    );
    expect(normalizeImageSourceUrl("https://upload.wikimedia.org/commons/test.png").hostname)
      .toBe("upload.wikimedia.org");
  });

  it("rejects private origins, plain HTTP and invalid Wikimedia URLs", () => {
    expect(() => normalizeImageSourceUrl(
      "https://commons.wikimedia.org/wiki/File:",
    )).toThrow(BadRequestException);
    expect(() => normalizeImageSourceUrl("http://commons.wikimedia.org/wiki/File:A.png"))
      .toThrow(BadRequestException);
    expect(() => normalizeImageSourceUrl("https://127.0.0.1/photo.png"))
      .toThrow(BadRequestException);
  });

  it.each([
    "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "SELF_SIGNED_CERT_IN_CHAIN",
    "CERT_HAS_EXPIRED", "ERR_TLS_CERT_ALTNAME_INVALID",
  ])("turns a TLS error (%s) into a helpful 502", (code) => {
    const error = Object.assign(new Error("network details"), { code });
    const mapped = imageDownloadError(error);
    expect(mapped).toBeInstanceOf(BadGatewayException);
    expect(mapped.getStatus()).toBe(502);
    expect(mapped.message).toContain("certificat HTTPS");
    expect(mapped.message).not.toContain("network details");
  });

  it("converts network and timeout errors into controlled 502 and 504 responses", () => {
    expect(imageDownloadError(Object.assign(new Error("unreachable"), {
      code: "ENOTFOUND",
    }))).toBeInstanceOf(BadGatewayException);
    expect(imageDownloadError(Object.assign(new Error("timed out"), {
      code: "ETIMEDOUT",
    }))).toBeInstanceOf(GatewayTimeoutException);
    expect(imageDownloadError(new Error("other reason")))
      .toBeInstanceOf(BadGatewayException);
  });

  it("keeps explicit validation messages instead of hiding them", () => {
    const bad = new BadRequestException("Un lien HTTPS est obligatoire.");
    expect(imageDownloadError(bad)).toBe(bad);
  });

  it("returns 503 for a nonwritable storage directory instead of unhandled 500", async () => {
    const broken = new HashtagMediaService({
      get: vi.fn().mockReturnValue(temp + "/missing-parent/file"),
    } as unknown as ConfigService);
    // The parent path is occupied by a file; mkdir of a child must fail.
    const { writeFile } = await import("node:fs/promises");
    await writeFile(temp + "/missing-parent", "not a directory");
    const input = await sharp({
      create: { width: 20, height: 20, channels: 3, background: "#335577" },
    }).png().toBuffer();
    await expect(broken.storeImage(input)).rejects.toThrow(ServiceUnavailableException);
  });
});
