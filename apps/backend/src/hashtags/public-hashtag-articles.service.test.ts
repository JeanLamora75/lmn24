import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CATEGORY_INITIAL_PAGE_SIZE } from "@lmn24/contracts";
import { describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../database/database.service";
import { decodeCategoryCursor } from "../categories/public-category.service";
import { PublicHashtagArticlesController } from "./public-hashtag-articles.controller";
import { PublicHashtagArticlesService } from "./public-hashtag-articles.service";

const subject = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "moscou", name: "Moscou", imageUrl: null,
  aliases: [{ name: "Moscow" }, { name: "Москва" }],
};
const id = (i: number) => "aaaaaaaa-aaaa-4aaa-8aaa-" + String(i).padStart(12, "0");
const now = new Date("2026-10-14T12:00:00.000Z");
const headlines = [
  { title: "Moscou et Москва", summary: "Moscow et Moscou" },
  { title: "News today", summary: "Moscow" },
  { title: "Сегодня Москва — важная новость", summary: null },
  { title: "NOUVELLES DE MOSCOU", summary: "" },
];
const rows = Array.from({ length: 120 }, (_, i) => {
  const headline = headlines[i % 4]!;
  return {
    id: id(120 - i), title: headline.title, summary: headline.summary,
    publishedAt: new Date(now.getTime() - (i + 1) * 300_000),
    imageUrl: null, articleUrl: "https://news.example/" + i,
    source: { name: "World News", logoUrl: null,
      country: { isoCode2: i % 2 ? "FR" : "RU" } },
  };
});

function fixture(custom = rows, active = true, value = "60") {
  const candidates = vi.fn(async (query: {
    where: {
      publishedAt: { gte: Date; lte: Date };
      OR?: [{ publishedAt: { lt: Date } }, { publishedAt: Date; id: { lt: string } }];
    };
    take: number;
  }) => {
    const lower = query.where.publishedAt.gte.getTime();
    const upper = query.where.publishedAt.lte.getTime();
    return custom.filter((row) => {
      if (row.publishedAt.getTime() < lower || row.publishedAt.getTime() > upper) return false;
      const cursor = query.where.OR?.[0]?.publishedAt.lt;
      if (!cursor) return true;
      const previous = query.where.OR![1]!;
      return row.publishedAt < cursor ||
        row.publishedAt.getTime() === cursor.getTime() && row.id < previous.id.lt;
    }).slice(0, query.take);
  });
  const details = vi.fn(async (query: { where: { id: { in: string[] } } }) =>
    custom.filter((row) => query.where.id.in.includes(row.id)).reverse());
  const findMany = vi.fn(async (query: { select: { summary: boolean } | { source: unknown } }) =>
    "source" in query.select ? details(query as never) : candidates(query as never));
  const prisma = {
    hashtag: { findFirst: vi.fn().mockResolvedValue(active ? subject : null) },
    setting: { findFirst: vi.fn().mockResolvedValue({ value }) },
    article: { findMany },
  };
  return { service: new PublicHashtagArticlesService({ prisma } as unknown as DatabaseService),
    prisma, candidates, details };
}

describe("SCRUM-55 — public hashtag detail matching and pagination", () => {
  it("counts each article once, even when main name and several aliases occur", async () => {
    const { service } = fixture();
    const page = await service.getArticles("moscou", undefined, 19, now);
    expect(page.items).toHaveLength(19);
    expect(new Set(page.items.map((a) => a.id)).size).toBe(19);
    expect(page.items[0]?.source.countryIsoCode2).toBe("RU");
    expect(page.items[0]?.title).toContain("Moscou");
    expect(page.hasMore).toBe(true);
    expect(decodeCategoryCursor(page.nextCursor!)).toMatchObject({
      id: rows[18]!.id, publishedAt: rows[18]!.publishedAt,
    });
  });

  it("retrieves every article across many pages, ordered by publishedAt and id", async () => {
    const { service, prisma } = fixture();
    const all: string[] = [];
    let next: string | undefined;
    let pages = 0;
    while (true) {
      const response = await service.getArticles(
        "moscou", next, pages === 0 ? CATEGORY_INITIAL_PAGE_SIZE : 14, now,
      );
      all.push(...response.items.map((article) => article.id));
      pages += 1;
      if (!response.hasMore) {
        expect(response.nextCursor).toBeNull();
        break;
      }
      next = response.nextCursor!;
      if (pages > 20) throw new Error("Cursor loop");
    }
    expect(all).toEqual(rows.map((r) => r.id));
    expect(new Set(all).size).toBe(120);
    expect(prisma.article.findMany.mock.calls.some(([q]) =>
      q.where?.languageIsoCode2 !== undefined)).toBe(false);
  });

  it("does not match substrings, different words or phrases across fields", async () => {
    const other = [
      { ...rows[0]!, id: id(1), title: "Moscou", summary: "Moscow" },
      { ...rows[1]!, id: id(2), title: "московский", summary: "Promoscow" },
      { ...rows[2]!, id: id(3), title: "Une promenade", summary: "Elsewhere" },
    ];
    const { service } = fixture(other);
    const page = await service.getArticles("moscou", undefined, 19, now);
    expect(page.items.map((r) => r.id)).toEqual([id(1)]);
  });

  it("ignores expired/future publications using the configured retention", async () => {
    const old = { ...rows[0]!, publishedAt: new Date("2026-08-01T00:00:00Z") };
    const future = { ...rows[1]!, publishedAt: new Date("2026-10-16T00:00:00Z") };
    const fresh = { ...rows[2]!, publishedAt: new Date("2026-10-13T00:00:00Z") };
    const { service, prisma } = fixture([fresh, future, old], true, "30");
    const page = await service.getArticles("moscou", undefined, 19, now);
    expect(page.items.map((r) => r.id)).toEqual([fresh.id]);
    expect(prisma.setting.findFirst).toHaveBeenCalledWith({
      where: { key: "retentionArticlesDays", scope: "GLOBAL", scopeId: null },
      select: { value: true },
    });
  });

  it("returns a coherent empty state, not 404, for active subjects without articles", async () => {
    const { service } = fixture([], true);
    await expect(service.getArticles("moscou", undefined, 19, now)).resolves.toMatchObject({
      hashtag: { slug: "moscou" }, items: [], hasMore: false, nextCursor: null,
    });
  });

  it("does not disclose an inactive or unknown hashtag or run the article query", async () => {
    const { service, prisma } = fixture([], false);
    await expect(service.getArticles("moscou", undefined, 19, now))
      .rejects.toThrow(NotFoundException);
    expect(prisma.article.findMany).not.toHaveBeenCalled();
  });

  it("rejects malformed cursor and out-of-range page sizes", async () => {
    const { service } = fixture();
    await expect(service.getArticles("moscou", "bad?!", 19, now))
      .rejects.toThrow(BadRequestException);
    await expect(service.getArticles("moscou", undefined, 500, now))
      .rejects.toThrow(BadRequestException);
    await expect(fixture([], true, "0").service.getArticles("moscou", undefined, 19, now))
      .rejects.toThrow(BadRequestException);
  });

  it("validates API parameters without requiring an interface locale", async () => {
    const getArticles = vi.fn().mockResolvedValue({ items: [], hasMore: false });
    const controller = new PublicHashtagArticlesController({
      getArticles,
    } as unknown as PublicHashtagArticlesService);
    await expect(controller.list("Moscou")).rejects.toThrow(BadRequestException);
    await expect(controller.list("moscou", undefined, "1000")).rejects.toThrow(BadRequestException);
    await controller.list("moscou", undefined, "14");
    expect(getArticles).toHaveBeenCalledWith("moscou", undefined, 14);
  });

  it("avoids full-table loading and fetches only selected card detail ids", async () => {
    const { service, prisma } = fixture();
    await service.getArticles("moscou", undefined, 19, now);
    expect(prisma.article.findMany.mock.calls[0]?.[0]).toMatchObject({
      take: 400, select: { id: true, publishedAt: true, title: true, summary: true },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    });
    const detailCall = prisma.article.findMany.mock.calls.find(([query]) =>
      query.select && "source" in query.select);
    expect(detailCall?.[0].where.id.in).toHaveLength(19);
  });
});
