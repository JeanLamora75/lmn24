import { describe, expect, it, vi } from "vitest";
import { ParserEngine } from "./parser-engine.js";

const feed = {
  id: "00000000-0000-4000-8000-000000000000",
  sourceId: "11111111-1111-4111-8111-111111111111",
  categoryId: "22222222-2222-4222-8222-222222222222",
  languageIsoCode2: "ru",
  feedUrl: "https://example.com/feed.xml",
};
const entries = [
  { title: "Москва", summary: "Moscou", imageUrl: "https://example.com/image.jpg",
    articleUrl: "https://example.com/a", publishedAt: new Date() },
  { title: "Un autre sujet", summary: null, imageUrl: "https://example.com/image.jpg",
    articleUrl: "https://example.com/b", publishedAt: new Date() },
];
type ImportArticles = (inputFeed: typeof feed, inputEntries: typeof entries) =>
  Promise<{ imported: number; matched: number }>;

describe("SCRUM-52 — parser inserts and counts in the same database transaction", () => {
  it("only counts committed, newly inserted articles once per hashtag", async () => {
    const createManyAndReturn = vi.fn().mockResolvedValue([
      { id: "id-a", title: "Москва", summary: "Moscou", publishedAt: entries[0]!.publishedAt },
    ]);
    const upsert = vi.fn().mockResolvedValue({});
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ acquired: 1 }]),
      setting: { findMany: vi.fn().mockResolvedValue([]) },
      hashtag: { findMany: vi.fn().mockResolvedValue([{
        id: "moscow", name: "Moscou", aliases: [{ name: "Москва" }],
      }]) },
      article: { createManyAndReturn },
      hashtagHourlyCount: { upsert },
    };
    const db = {
      article: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn(async (callback: (input: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const engine = new ParserEngine(db as never);
    const fn = (engine as unknown as { importArticles: ImportArticles }).importArticles.bind(engine);
    const result = await fn(feed, [entries[0]!, entries[0]!, entries[1]!]);
    expect(result).toEqual({ imported: 1, matched: 1 });
    expect(createManyAndReturn).toHaveBeenCalledOnce();
    expect(upsert).toHaveBeenCalledOnce();
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ hashtagId: "moscow", articleCount: 1 }),
      update: { articleCount: { increment: 1 } },
    }));
  });

  it("never creates counters for already imported URLs", async () => {
    const transaction = vi.fn();
    const db = {
      article: {
        findMany: vi.fn().mockResolvedValue([{ articleUrl: entries[0]!.articleUrl }]),
      },
      $transaction: transaction,
    };
    const engine = new ParserEngine(db as never);
    const fn = (engine as unknown as { importArticles: ImportArticles }).importArticles.bind(engine);
    expect(await fn(feed, [entries[0]!])).toEqual({ imported: 0, matched: 0 });
    expect(transaction).not.toHaveBeenCalled();
  });
});
