import { compileHashtags } from "@lmn24/contracts";
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
    articleUrl: "https://example.com/a", publishedAt: new Date("2026-10-12T09:00:00Z") },
  { title: "Un autre sujet", summary: null, imageUrl: "https://example.com/image.jpg",
    articleUrl: "https://example.com/b", publishedAt: new Date("2026-10-12T10:00:00Z") },
];
const matches = compileHashtags([
  { id: "moscou", name: "Moscou", aliases: [{ name: "Москва" }] },
]);
type ImportArticles = (inputFeed: typeof feed, inputEntries: typeof entries,
  activeHashtags: typeof matches) => Promise<{ imported: number; matched: number }>;

describe("SCRUM-51 — parser only counts committed, unique inserted articles", () => {
  it("never attributes a duplicate feed item to newly imported hashtag matches", async () => {
    const createManyAndReturn = vi.fn().mockResolvedValue([
      { id: "id-a", title: "Москва", summary: "Moscou", publishedAt: entries[0]!.publishedAt },
    ]);
    const db = {
      article: { findMany: vi.fn().mockResolvedValue([]), createManyAndReturn },
    };
    const engine = new ParserEngine(db as never);
    const fn = (engine as unknown as { importArticles: ImportArticles }).importArticles.bind(engine);
    const result = await fn(feed, [entries[0]!, entries[0]!, entries[1]!], matches);
    expect(result).toEqual({ imported: 1, matched: 1 });
    expect(createManyAndReturn).toHaveBeenCalledOnce();
    expect(createManyAndReturn.mock.calls[0]?.[0]).toMatchObject({
      skipDuplicates: true, select: { title: true, summary: true },
    });
  });
  it("leaves the import untouched if all URLs already exist", async () => {
    const createManyAndReturn = vi.fn();
    const db = {
      article: {
        findMany: vi.fn().mockResolvedValue([{ articleUrl: entries[0]!.articleUrl }]),
        createManyAndReturn,
      },
    };
    const engine = new ParserEngine(db as never);
    const fn = (engine as unknown as { importArticles: ImportArticles }).importArticles.bind(engine);
    expect(await fn(feed, [entries[0]!], matches)).toEqual({ imported: 0, matched: 0 });
    expect(createManyAndReturn).not.toHaveBeenCalled();
  });
});
