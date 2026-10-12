import { describe, expect, it, vi } from "vitest";
import { PublicVideosService, decodeVideoCursor } from "./public-videos.service";

describe("SCRUM-43 public video isolation", () => {
  it("rejects invalid cursors", () => {
    expect(() => decodeVideoCursor("invalid!")).toThrow();
  });

  it("filters videos by exact locale and visibility, with stable keyset sorting", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = { prisma: { video: { findMany } } };
    const service = new PublicVideosService(db as never);
    const result = await service.list({ locale: "fr", limit: 24 });
    expect(result).toEqual({ items: [], hasMore: false, nextCursor: null });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        languageIsoCode2: "fr", isPublished: true,
        source: { isActive: true }, category: { isActive: true },
      }),
      take: 25, orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    }));
  });
});
