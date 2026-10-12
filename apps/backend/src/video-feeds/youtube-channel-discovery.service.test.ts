import { describe, expect, it } from "vitest";
import { normalizeYouTubeLookup, youtubeChannelFromHtml } from "./youtube-channel-discovery.service";

const channel = "UC" + "x".repeat(22);

describe("YouTube channel ID lookup", () => {
  it("recognizes canonical channel IDs and YouTube channel URLs", () => {
    expect(normalizeYouTubeLookup(channel).channelId).toBe(channel);
    expect(normalizeYouTubeLookup("https://www.youtube.com/channel/" + channel).channelId).toBe(channel);
    expect(normalizeYouTubeLookup("@examplechannel").url).toBe("https://www.youtube.com/@examplechannel");
  });
  it("rejects arbitrary URLs to avoid SSRF", () => {
    for (const input of ["http://www.youtube.com/@handle", "https://youtube.com.evil.example/@handle", "https://www.youtube.com/redirect?q=http://localhost", "https://127.0.0.1/"]) {
      expect(() => normalizeYouTubeLookup(input)).toThrow();
    }
  });
  it("extracts verified channel IDs and refuses unknown pages", () => {
    expect(youtubeChannelFromHtml('<meta itemprop="channelId" content="' + channel + '">')).toBe(channel);
    expect(youtubeChannelFromHtml('<script>{"externalId":"' + channel + '"}</script>')).toBe(channel);
    expect(youtubeChannelFromHtml("<p>Unrelated page</p>")).toBeNull();
  });
});
