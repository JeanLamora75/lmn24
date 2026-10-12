import { describe, expect, it } from "vitest";
import { videoFeedInputSchema, videoFeedListSchema } from "./video-feeds.schemas";

const channelId = "UC" + "a".repeat(22);
const valid = {
  sourceId: "11111111-1111-4111-8111-111111111111",
  categoryId: "22222222-2222-4222-8222-222222222222",
  languageIsoCode2: "FR",
  channelId,
  feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=" + channelId,
  isActive: true,
};

describe("SCRUM-38 YouTube video feed validation", () => {
  it("accepts a canonical Atom feed and normalizes language", () => {
    const result = videoFeedInputSchema.parse(valid);
    expect(result.languageIsoCode2).toBe("fr");
  });
  it.each([
    "http://www.youtube.com/feeds/videos.xml?channel_id=" + channelId,
    "https://youtube.com/feeds/videos.xml?channel_id=" + channelId,
    "https://www.youtube.com/feeds/videos.xml?channel_id=UC" + "b".repeat(22),
    "https://www.youtube.com/feeds/videos.xml?channel_id=" + channelId + "&extra=1",
    "https://evil.example/feeds/videos.xml?channel_id=" + channelId,
  ])("rejects noncanonical or mismatched feed URL: %s", (feedUrl) => {
    expect(videoFeedInputSchema.safeParse({ ...valid, feedUrl }).success).toBe(false);
  });
  it("rejects malformed channel ids", () => {
    expect(videoFeedInputSchema.safeParse({ ...valid, channelId: "@MyChannel" }).success).toBe(false);
  });
  it("rejects unexpected input and supports paginated status filters", () => {
    expect(videoFeedListSchema.parse({ page: "2", status: "inactive" })).toMatchObject({ page: 2, pageSize: 10, status: "inactive" });
    expect(videoFeedListSchema.safeParse({ pageSize: "1000" }).success).toBe(false);
  });
});
