import { afterEach, describe, expect, it, vi } from "vitest";
import { VideoParserEngine } from "./video-parser-engine.js";
import type { ParserEvent } from "./parser-engine.js";

const channel = "UC" + "a".repeat(22);
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
<title>Example channel</title><entry>
<id>yt:video:abcdefghijk</id>
<yt:videoId>abcdefghijk</yt:videoId><yt:channelId>${channel}</yt:channelId>
<title>Vidéo publiée</title><published>2026-10-11T12:00:00Z</published>
<media:group><media:thumbnail url="https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg"/></media:group>
</entry></feed>`;

function mockDb(feeds: Array<{ id: string; sourceId: string; categoryId: string; languageIsoCode2: string; channelId: string; feedUrl: string }>, counts: number[]) {
  const findMany = vi.fn(async () => feeds);
  const create = vi.fn(async () => ({ id: "11111111-1111-4111-8111-111111111111" }));
  const createMany = vi.fn(async () => ({ count: counts.shift() ?? 0 }));
  const update = vi.fn(async (args: unknown) => args);
  const updateRun = vi.fn(async (args: unknown) => args);
  const transaction = vi.fn(async (queries: unknown[]) => queries);
  const database = {
    feedVideo: { findMany, update },
    feedVideoRun: { create, update: updateRun },
    video: { createMany },
    $transaction: transaction,
  };
  return { database, findMany, createMany, update, updateRun };
}
function feed(id: string, locale: string) {
  return {
    id, sourceId: "22222222-2222-4222-8222-222222222222",
    categoryId: "33333333-3333-4333-8333-333333333333",
    languageIsoCode2: locale, channelId: channel,
    feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=" + channel,
  };
}
afterEach(() => vi.unstubAllGlobals());

describe("SCRUM-46 — batch video parser", () => {
  it("does not persist a video after lease cancellation", async () => {
    const db = mockDb([feed("a", "fr")], [1]);
    const controller = new AbortController();
    vi.stubGlobal("fetch", vi.fn(async () => {
      controller.abort();
      return new Response(xml, { status: 200 });
    }));
    await expect(new VideoParserEngine(db.database as never)
      .run({}, undefined, undefined, controller.signal))
      .rejects.toThrow("Video parser global lease lost");
    expect(db.createMany).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("selects every active channel with no filters, inserts only new videos, and emits progress", async () => {
    const db = mockDb([feed("a", "fr"), feed("b", "de")], [1, 0]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(xml, { status: 200 })));
    const events: ParserEvent[] = [];
    const summary = await new VideoParserEngine(db.database as never).run({}, event => events.push(event));

    expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: true },
    }));
    expect(summary).toEqual({ feeds: 2, successful: 2, failed: 0, imported: 1, skipped: 1 });
    expect(events.map(event => event.type)).toEqual([
      "run-started", "feed-started", "feed-success",
      "feed-started", "feed-success", "run-completed",
    ]);
    expect(events.at(-1)?.message).toContain("1 nouvelles vidéos enregistrées");
    expect(db.createMany).toHaveBeenCalledTimes(2);
    expect(db.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [expect.objectContaining({
        languageIsoCode2: "de", publishedAt: new Date("2026-10-11T12:00:00.000Z"),
      })],
    }));
    expect(db.updateRun).toHaveBeenCalledTimes(2);
  });

  it("filters active feeds by country, language and category", async () => {
    const db = mockDb([], []);
    const result = await new VideoParserEngine(db.database as never).run({
      countryIsoCode2: "de", languageIsoCode2: "EN",
      categoryId: "33333333-3333-4333-8333-333333333333",
    });
    expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        isActive: true,
        categoryId: "33333333-3333-4333-8333-333333333333",
        languageIsoCode2: "en",
        source: { country: { isoCode2: "DE" } },
      },
    }));
    expect(result.feeds).toBe(0);
  });

  it("retains the individual feed collection and continues past a failed channel", async () => {
    const db = mockDb([feed("a", "fr"), feed("b", "en")], [1]);
    let index = 0;
    vi.stubGlobal("fetch", vi.fn(async () =>
      index++ === 0 ? new Response("Blocked", { status: 403 }) : new Response(xml, { status: 200 }),
    ));
    const events: ParserEvent[] = [];
    const summary = await new VideoParserEngine(db.database as never).run({}, event => events.push(event));
    expect(summary).toEqual({ feeds: 2, successful: 1, failed: 1, imported: 1, skipped: 0 });
    expect(events.map(event => event.type)).toContain("feed-error");
    expect(events.at(-1)?.type).toBe("run-completed");
    expect(db.updateRun).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "ERROR", errorMessage: "HTTP 403" }),
    }));
  });

  it("respects the pre-existing single-feed collection filter", async () => {
    const db = mockDb([], []);
    await new VideoParserEngine(db.database as never).run({ feedId: "a" });
    expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: true, id: "a" },
    }));
  });
});
