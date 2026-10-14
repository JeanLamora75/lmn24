import { BadGatewayException, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { lookup } from "node:dns/promises";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { request as httpsRequest } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HashtagMediaService } from "./hashtag-media.service";

vi.mock("node:https", () => ({ request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));

type FakeResponse = EventEmitter & {
  statusCode: number; headers: Record<string, string>;
  resume: () => void;
};
let dir: string;
let media: HashtagMediaService;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "lmn24-url-test-"));
  media = new HashtagMediaService({
    get: vi.fn().mockReturnValue(dir),
  } as unknown as ConfigService);
  vi.mocked(lookup).mockResolvedValue([
    { address: "93.184.216.34", family: 4 },
  ] as never);
  vi.mocked(httpsRequest).mockReset();
});
afterEach(async () => {
  vi.resetAllMocks();
  await rm(dir, { recursive: true, force: true });
});

function mockRemote(hops: Array<{
  status?: number;
  location?: string,
  type?: string,
  body?: Buffer,
  code?: string,
}>) {
  const optionsSeen: Array<{
    rejectUnauthorized?: boolean,
    ca?: string[],
    lookup?: (hostname: string, options: unknown,
      callback: (error: null, address: string, family: number) => void) => void,
  }> = [];
  const seenUrls: string[] = [];
  vi.mocked(httpsRequest).mockImplementation(((...args: unknown[]) => {
    const url = args[0] as URL;
    const options = args[1] as typeof optionsSeen[number];
    const onResponse = args[2] as (response: FakeResponse) => void;
    seenUrls.push(url.toString());
    optionsSeen.push(options);
    const hop = hops.shift();
    if (!hop) throw new Error("unexpected extra download");
    const req = new EventEmitter() as EventEmitter & {
      end(): void; destroy(error?: Error): void;
    };
    req.destroy = (error?: Error) => {
      queueMicrotask(() => req.emit("error", error ?? new Error("destroyed")));
    };
    req.end = () => {
      queueMicrotask(() => {
        if (hop.code) {
          req.emit("error", Object.assign(new Error("connection failed"), {
            code: hop.code,
          }));
          return;
        }
        const response = Object.assign(new EventEmitter(), {
          statusCode: hop.status ?? 200,
          headers: { "content-type": hop.type ?? "image/png",
            ...(hop.location ? { location: hop.location } : {}) },
          resume: vi.fn(),
        }) as FakeResponse;
        onResponse(response);
        if ((hop.status ?? 200) === 200) {
          response.emit("data", hop.body ?? Buffer.from("invalid"));
          response.emit("end");
        }
      });
    };
    return req;
  }) as typeof httpsRequest);
  return { optionsSeen, seenUrls };
}

describe("Hashtag image download over verified HTTPS", () => {
  it("downloads PNG with pinned DNS, strict TLS and trusted root stores", async () => {
    const png = await sharp({
      create: { width: 50, height: 40, channels: 3, background: "#225577" },
    }).png().toBuffer();
    const { optionsSeen, seenUrls } = mockRemote([{ body: png }]);
    const imageUrl = await media.importFromUrl(
      "https://upload.wikimedia.org/commons/a/test.png",
    );
    expect(imageUrl).toMatch(/^\/api\/media\/hashtags\/[a-f0-9-]{36}\.webp$/);
    expect((await sharp(await media.readImage(imageUrl.split("/").at(-1)!))
      .metadata()).format).toBe("webp");
    expect(seenUrls).toEqual(["https://upload.wikimedia.org/commons/a/test.png"]);
    expect(optionsSeen[0]?.rejectUnauthorized).toBe(true);
    expect(optionsSeen[0]?.ca?.length).toBeGreaterThan(0);
    const lookupCallback = vi.fn();
    optionsSeen[0]?.lookup?.("upload.wikimedia.org", {}, lookupCallback);
    expect(lookupCallback).toHaveBeenCalledWith(null, "93.184.216.34", 4);
  });

  it("follows a Wikimedia file-page redirect to a second validated HTTPS origin", async () => {
    const png = await sharp({
      create: { width: 20, height: 20, channels: 3, background: "#225577" },
    }).png().toBuffer();
    const { seenUrls } = mockRemote([
      { status: 302, location: "https://upload.wikimedia.org/commons/abc/image.png" },
      { body: png },
    ]);
    await media.importFromUrl("https://commons.wikimedia.org/wiki/File:Image.png");
    expect(seenUrls).toEqual([
      "https://commons.wikimedia.org/wiki/Special:FilePath/Image.png",
      "https://upload.wikimedia.org/commons/abc/image.png",
    ]);
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("turns certificate failures into an actionable 502, never Internal error", async () => {
    mockRemote([{ code: "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" }]);
    await expect(media.importFromUrl("https://example.com/photo.jpg"))
      .rejects.toThrow(BadGatewayException);
  });

  it("rejects links pointing to HTML pages rather than a valid image", async () => {
    mockRemote([{ type: "text/html", body: Buffer.from("<html>Not an image</html>") }]);
    await expect(media.importFromUrl("https://example.com/page"))
      .rejects.toThrow(BadRequestException);
  });

  it("does not follow redirects to private hosts", async () => {
    const { seenUrls } = mockRemote([
      { status: 302, location: "https://localhost/admin" },
    ]);
    await expect(media.importFromUrl("https://example.com/photo.png"))
      .rejects.toThrow(BadRequestException);
    expect(seenUrls).toHaveLength(1);
  });
});
