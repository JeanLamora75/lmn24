import { describe, expect, it, vi } from "vitest";
import { PublicVideosService, decodeVideoCursor } from "./public-videos.service";

const locales = ["fr", "es", "en", "pt", "de", "it", "ru", "nl"] as const;

describe("SCRUM-43 public video isolation", () => {
  it("rejects invalid cursors", () => {
    expect(() => decodeVideoCursor("invalid!")).toThrow();
  });

  it.each(locales)("loads published videos in the exact %s language, even from inactive sources", async locale => {
    const video = {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Test video", publishedAt: new Date("2026-10-12T12:00:00.000Z"),
      source: { id: "source-id", name: "Media", country: { isoCode2: "DE" } },
      category: { id: "category-id", slug: "news", displayOrder: 1, themeColor: "#112233" },
    };
    const findMany = vi.fn().mockResolvedValue([video]);
    const db = { prisma: { video: { findMany } } };
    const service = new PublicVideosService(db as never);
    const result = await service.list({ locale, limit: 24 });
    expect(result).toEqual({ items: [video], hasMore: false, nextCursor: null });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        languageIsoCode2: locale,
        isPublished: true,
        category: { isActive: true },
      },
      take: 25, orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    }));
    // No source.isActive clause: an explicit publication decision takes priority,
    // matching the public articles homepage.
    expect(findMany.mock.calls[0]?.[0]?.where?.source).toBeUndefined();
  });

  it("keeps country filtering available at API level without excluding inactive sources", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new PublicVideosService({ prisma: { video: { findMany } } } as never);
    await service.list({ locale: "de", country: "DE", limit: 24 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        languageIsoCode2: "de",
        source: { country: { isoCode2: "DE" } },
      }),
    }));
  });

  it("returns an empty, non-error page when a language has no published videos", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new PublicVideosService({ prisma: { video: { findMany } } } as never);
    expect(await service.list({ locale: "pt", limit: 24 }))
      .toEqual({ items: [], hasMore: false, nextCursor: null });
  });
});
