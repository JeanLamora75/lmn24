import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../database/database.service";
import { HashtagTrendsService } from "./hashtag-trends.service";
import { HashtagRankingsController } from "./hashtag-rankings.controller";

const subject = { id: "id", name: "Moscou", slug: "moscou", imageUrl: null };
function controller(found: typeof subject | null) {
  const findFirst = vi.fn().mockResolvedValue(found);
  const db = { prisma: { hashtag: { findFirst } } } as unknown as DatabaseService;
  return { controller: new HashtagRankingsController({} as HashtagTrendsService, db), findFirst };
}

describe("SCRUM-54 — active-only public subject lookup", () => {
  it("returns a topic without an admin session when active", async () => {
    const { controller: api, findFirst } = controller(subject);
    await expect(api.subject("moscou")).resolves.toEqual(subject);
    expect(findFirst).toHaveBeenCalledWith({
      where: { slug: "moscou", isActive: true },
      select: { id: true, slug: true, name: true, imageUrl: true },
    });
  });
  it("does not expose inactive or unknown subjects", async () => {
    await expect(controller(null).controller.subject("moscou"))
      .rejects.toThrow(NotFoundException);
  });
  it.each(["", "Moscou", "foo/../bar", "a".repeat(256)])(
    "rejects malformed slugs: %s", async (slug) => {
      const { controller: api, findFirst } = controller(subject);
      await expect(api.subject(slug)).rejects.toThrow(NotFoundException);
      expect(findFirst).not.toHaveBeenCalled();
    },
  );
});
