import { BadRequestException, HttpException, UnprocessableEntityException } from "@nestjs/common";
import { chromium, type Browser } from "playwright";
import { ConfigService } from "@nestjs/config";
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

function service(youtubeUrl: string | null = "https://www.youtube.com/@examplechannel", apiKey?: string) {
  const findUnique = vi.fn(async () => ({ youtubeUrl }));
  const discovery = new YoutubeChannelDiscoveryService(
    { prisma: { source: { findUnique } } } as unknown as DatabaseService,
    { get: vi.fn((key: string) => key === "YOUTUBE_API_KEY" ? apiKey : undefined) } as unknown as ConfigService,
  );
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
      .rejects.toThrow(HttpException);
    expect(chromium.launch).not.toHaveBeenCalled();
  });

  it("reports a user-actionable 422 without inventing a channel ID", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response("<html>unknown</html>")));
    const browser = mockBrowser("<html>no metadata</html>");
    await expect(service().discovery.resolve({ query: "@examplechannel" }))
      .rejects.toThrow("Ouvrez la chaîne dans Chrome");
    expect(browser.browser.close).toHaveBeenCalledOnce();
  });

  it("extracts the exact iOS App Links meta tag provided by an editor", () => {
    const channelId = "UCZIJs433Z7v-DmCMNYS-GLg";
    const html = '<meta property="al:ios:url" content="vnd.youtube://www.youtube.com/channel/' + channelId + '">';
    expect(youtubeChannelFromHtml(html)).toBe(channelId);
  });

  it("supports Android/iOS App Links regardless of attribute order and quoting", () => {
    const ios = '<meta content="vnd.youtube://www.youtube.com/channel/' + channel + '" property="al:ios:url">';
    const android = "<META CONTENT='vnd.youtube://youtube.com/channel/" + channel + "' PROPERTY='al:android:url'>";
    const web = '<meta property="al:web:url" content="https://www.youtube.com/channel/' + channel + '/videos">';
    const twitter = '<meta name="twitter:app:url:googleplay" content="vnd.youtube://www.youtube.com/channel/' + channel + '">';
    for (const html of [ios, android, web, twitter]) {
      expect(youtubeChannelFromHtml(html)).toBe(channel);
    }
  });

  it("rejects spoofed App Link hosts, video deep links, and invalid channel IDs", () => {
    for (const content of [
      "vnd.youtube://www.youtube.com.evil.test/channel/" + channel,
      "vnd.youtube://evil.test/channel/" + channel,
      "vnd.youtube://www.youtube.com/watch?v=abcdefghijk",
      "vnd.youtube://www.youtube.com/channel/UCshort",
      "vnd.youtube://www.youtube.com/channel/" + channel + "extrachar",
    ]) {
      expect(youtubeChannelFromHtml('<meta property="al:ios:url" content="' + content + '">')).toBeNull();
    }
    expect(youtubeChannelFromHtml('<meta property="al:ios:app_name" content="vnd.youtube://www.youtube.com/channel/' + channel + '">')).toBeNull();
  });

  it("resolves App Links from the normal HTML request without needing Chromium", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      response('<meta property="al:ios:url" content="vnd.youtube://www.youtube.com/channel/' + channel + '">'),
    ));
    await expect(service().discovery.resolve({ query: "@examplechannel" })).resolves.toEqual(expected);
    expect(chromium.launch).not.toHaveBeenCalled();
  });

  it("resolves App Links from Chromium's HTML when the HTTP fetch is blocked", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response("Forbidden", { status: 403 })));
    const browser = mockBrowser('<meta property="al:android:url" content="vnd.youtube://www.youtube.com/channel/' + channel + '">');
    await expect(service().discovery.resolve({ query: "@examplechannel" })).resolves.toEqual(expected);
    expect(browser.browser.close).toHaveBeenCalledOnce();
  });

  it("resolves a pasted App Link tag without network access even if a source is selected", async () => {
    const channelId = "UCZIJs433Z7v-DmCMNYS-GLg";
    const meta = '<meta property="al:ios:url" content="vnd.youtube://www.youtube.com/channel/' + channelId + '">';
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { discovery, findUnique } = service(null);
    await expect(discovery.resolve({ sourceId, query: meta })).resolves.toEqual({
      channelId,
      feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=" + channelId,
    });
    expect(findUnique).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(chromium.launch).not.toHaveBeenCalled();
  });

  it("rejects pasted App Links with spoofed domains rather than falling back to source", async () => {
    const malicious = '<meta property="al:ios:url" content="vnd.youtube://www.youtube.com.evil.test/channel/' + channel + '">';
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(service().discovery.resolve({ sourceId, query: malicious }))
      .rejects.toThrow(BadRequestException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("prioritizes the official YouTube API for Corriere dello Sport when a key is configured", async () => {
    const original = "https://www.youtube.com/@corrieredellosport-official";
    const apiId = "UCZIJs433Z7v-DmCMNYS-GLg";
    const fetchSpy = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      expect(url.hostname).toBe("www.googleapis.com");
      expect(url.pathname).toBe("/youtube/v3/channels");
      expect(url.searchParams.get("part")).toBe("id");
      expect(url.searchParams.get("forHandle")).toBe("@corrieredellosport-official");
      expect(url.searchParams.get("key")).toBe("dummy-test-key");
      return response(JSON.stringify({ items: [{ id: apiId }] }), {
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchSpy);
    await expect(service(original, "dummy-test-key").discovery.resolve({ sourceId })).resolves.toEqual({
      channelId: apiId, feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=" + apiId,
    });
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(chromium.launch).not.toHaveBeenCalled();
  });

  it("preserves the existing scraper when there is no YOUTUBE_API_KEY", async () => {
    const fetchSpy = vi.fn(async () => response('<meta itemprop="channelId" content="' + channel + '">'));
    vi.stubGlobal("fetch", fetchSpy);
    await expect(service("https://www.youtube.com/@examplechannel").discovery.resolve({ sourceId })).resolves.toEqual(expected);
    const [url] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toContain("youtube.com/@examplechannel");
    expect(String(url)).not.toContain("googleapis.com");
  });

  it("falls back if the official API returns an error and does not expose the key", async () => {
    const fetchSpy = vi.fn(async (input: string | URL | Request) => {
      if (String(input).includes("googleapis.com")) return response("", { status: 403 });
      return response("<html>no meta</html>", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchSpy);
    vi.mocked(chromium.launch).mockRejectedValue(new Error("Browser unavailable"));
    const privateKey = "private-test-key";
    await expect(service("https://www.youtube.com/@examplechannel", privateKey).discovery.resolve({ sourceId }))
      .rejects.toThrow("Vérifiez la clé YOUTUBE_API_KEY");
    try {
      await service("https://www.youtube.com/@examplechannel", privateKey).discovery.resolve({ sourceId });
    } catch (error) {
      expect(String(error)).not.toContain(privateKey);
    }
  });

  it("keeps the manual fallback when the API returns no matching channel", async () => {
    const fetchSpy = vi.fn(async (input: string | URL | Request) =>
      String(input).includes("googleapis.com")
        ? response(JSON.stringify({ items: [] }))
        : response('<meta property="al:ios:url" content="vnd.youtube://www.youtube.com/channel/' + channel + '">'),
    );
    vi.stubGlobal("fetch", fetchSpy);
    await expect(service("https://www.youtube.com/@examplechannel", "dummy-test-key").discovery.resolve({ sourceId }))
      .resolves.toEqual(expected);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("never calls the official API for direct UC IDs", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(service(null, "dummy-test-key").discovery.resolve({ query: channel })).resolves.toEqual(expected);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("explains missing Youtube URL instead of returning a generic 422", async () => {
    await expect(service(null).discovery.resolve({ sourceId }))
      .rejects.toThrow(BadRequestException);
  });
});
