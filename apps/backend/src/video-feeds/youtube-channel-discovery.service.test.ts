import { BadRequestException, TooManyRequestsException, UnprocessableEntityException } from "@nestjs/common";
import { chromium, type Browser } from "playwright";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../database/database.service";
import {
  normalizeYouTubeLookup,
  youtubeChannelFromHtml,
  YoutubeChannelDiscoveryService,
} from "./youtube-channel-discovery.service";

vi.mock("playwright", () => ({ chromium: { launch: vi.fn() } }));

const channel = "UC" + "x".repeat(22);
const feedUrl = "https://www.youtube.com/feeds/videos.xml?channel_id=" + channel;
const expected = { channelId: channel, feedUrl };
const sourceId = "11111111-1111-4111-8111-111111111111";

function service(youtubeUrl: string | null = "https://www.youtube.com/@examplechannel") {
  const findUnique = vi.fn(async () => ({ youtubeUrl }));
  const discovery = new YoutubeChannelDiscoveryService({
    prisma: { source: { findUnique } },
  } as unknown as DatabaseService);
  return { discovery, findUnique };
}

function response(body: string, options?: ResponseInit): Response {
  return new Response(body, options);
}

function mockBrowser(html: string, finalUrl = "https://www.youtube.com/@examplechannel") {
  const page = {
    goto: vi.fn(async () => ({ ok: () => true })),
    content: vi.fn(async () => html),
    url: vi.fn(() => finalUrl),
  };
  const context = {
    route: vi.fn(async () => undefined),
    newPage: vi.fn(async () => page),
    close: vi.fn(async () => undefined),
  };
  const browser = {
    newContext: vi.fn(async () => context),
    close: vi.fn(async () => undefined),
  };
  vi.mocked(chromium.launch).mockResolvedValue(browser as unknown as Browser);
  return { page, context, browser };
}

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("YouTube channel ID lookup", () => {
  it("resolves UC identifiers and canonical YouTube URLs without network access", async () => {
    const { discovery } = service();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    for (const query of [channel, "https://www.youtube.com/channel/" + channel,
      "https://www.youtube.com/channel/" + channel + "/videos", feedUrl]) {
      await expect(discovery.resolve({ query })).resolves.toEqual(expected);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(chromium.launch).not.toHaveBeenCalled();
  });

  it("resolves an @handle by the official page's HTML metadata", async () => {
    const fetchSpy = vi.fn(async () => response('<meta itemprop="channelId" content="' + channel + '">'));
    vi.stubGlobal("fetch", fetchSpy);
    const { discovery, findUnique } = service();
    await expect(discovery.resolve({ sourceId })).resolves.toEqual(expected);
    expect(findUnique).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(chromium.launch).not.toHaveBeenCalled();
  });

  it("extracts owner metadata with alternate attribute order", () => {
    expect(youtubeChannelFromHtml('<meta content="' + channel + '" itemprop="channelId">')).toBe(channel);
    expect(youtubeChannelFromHtml('<script>{"externalId":"' + channel + '"}</script>')).toBe(channel);
    expect(youtubeChannelFromHtml('<link rel="canonical" href="https://www.youtube.com/channel/' + channel + '">')).toBe(channel);
    expect(youtubeChannelFromHtml("<p>Unrelated page</p>")).toBeNull();
  });

  it("accepts a same-site canonical redirect and refuses unrelated redirect URLs", async () => {
    const redirect = vi.fn(async () => response("", { status: 302, headers: { location: "/channel/" + channel } }));
    vi.stubGlobal("fetch", redirect);
    await expect(service().discovery.resolve({ query: "@examplechannel" })).resolves.toEqual(expected);
    expect(redirect).toHaveBeenCalledOnce();
  });

  it("retries with a normal browser when the public HTML is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response("Forbidden", { status: 403 })));
    const browser = mockBrowser('<meta itemprop="channelId" content="' + channel + '">');
    await expect(service().discovery.resolve({ query: "@examplechannel" })).resolves.toEqual(expected);
    expect(browser.page.goto).toHaveBeenCalledWith(
      "https://www.youtube.com/@examplechannel",
      expect.objectContaining({ waitUntil: "domcontentloaded" }),
    );
    expect(browser.context.route).toHaveBeenCalledOnce();
    expect(browser.browser.close).toHaveBeenCalledOnce();
  });

  it("does not chase off-site redirects, spoofed YouTube hosts or private addresses", async () => {
    for (const input of [
      "http://www.youtube.com/@handle",
      "https://youtube.com.evil.example/@handle",
      "https://www.youtube.com:444/@handle",
      "https://www.youtube.com/redirect?q=http://localhost",
      "https://127.0.0.1/",
    ]) {
      expect(() => normalizeYouTubeLookup(input)).toThrow(BadRequestException);
    }
    const fetchSpy = vi.fn(async () => response("", {
      status: 302, headers: { location: "http://127.0.0.1/private" },
    }));
    vi.stubGlobal("fetch", fetchSpy);
    vi.mocked(chromium.launch).mockRejectedValue(new Error("Browser unavailable"));
    await expect(service().discovery.resolve({ query: "@examplechannel" }))
      .rejects.toThrow(UnprocessableEntityException);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("respects rate limiting and does not retry the browser when YouTube sends 429", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response("", { status: 429 })));
    await expect(service().discovery.resolve({ query: "@examplechannel" }))
      .rejects.toThrow(TooManyRequestsException);
    expect(chromium.launch).not.toHaveBeenCalled();
  });

  it("reports a user-actionable 422 without inventing a channel ID", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response("<html>unknown</html>")));
    const browser = mockBrowser("<html>no metadata</html>");
    await expect(service().discovery.resolve({ query: "@examplechannel" }))
      .rejects.toThrow("Ouvrez la chaîne dans Chrome");
    expect(browser.browser.close).toHaveBeenCalledOnce();
  });

  it("explains missing Youtube URL instead of returning a generic 422", async () => {
    await expect(service(null).discovery.resolve({ sourceId }))
      .rejects.toThrow(BadRequestException);
  });
});
