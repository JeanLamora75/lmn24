import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../database/database.service";
import { HashtagHistoryService } from "./hashtag-history.service";

const id = "11111111-1111-4111-8111-111111111111";
const firstId = "22222222-2222-4222-8222-222222222222";
const stamp = new Date("2026-10-13T08:15:00.000Z");
const subject = {
  id, name: "Moscou", updatedAt: stamp,
  aliases: [{ name: "Moscow" }, { name: "Москва" }],
};
function api(subjectValue: typeof subject | null = subject) {
  const findMany = vi.fn().mockResolvedValue([
    { id: firstId, title: "Moscou et Москва", summary: "Moscow", publishedAt: stamp },
    { id: "33333333-3333-4333-8333-333333333333",
      title: "Autre actualité", summary: null, publishedAt: stamp },
  ]);
  const prisma = {
    hashtag: { findUnique: vi.fn().mockResolvedValue(subjectValue) },
    setting: { findFirst: vi.fn().mockResolvedValue({ value: "60" }) },
    article: { findMany },
  };
  return { service: new HashtagHistoryService({ prisma } as unknown as DatabaseService), prisma };
}
describe("SCRUM-51 — analysis of retained articles", () => {
  it("returns one hit per article despite multiple matching aliases", async () => {
    const { service, prisma } = api();
    const result = await service.scanPage(id, { asOf: "2026-10-13T09:00:00.000Z" });
    expect(result).toMatchObject({
      scannedArticles: 2, matchingArticles: 1, nextCursor: null, retentionDays: 60,
      hourlyMatches: [{ hourUtc: "2026-10-13T08:00:00.000Z", articleCount: 1 }],
    });
    expect(prisma.article.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 500, orderBy: { id: "asc" },
      where: { publishedAt: { gte: expect.any(Date), lte: expect.any(Date) } },
    }));
  });
  it("uses a stable cursor and refuses changed subject definitions", async () => {
    const { service, prisma } = api();
    const result = await service.scanPage(id, {
      asOf: new Date().toISOString(), cursor: firstId, version: stamp.toISOString(),
    });
    expect(result.scannedArticles).toBe(2);
    expect(prisma.article.findMany).toHaveBeenCalledWith(expect.objectContaining({
      cursor: { id: firstId }, skip: 1,
    }));
    await expect(service.scanPage(id, {
      asOf: new Date().toISOString(), version: new Date(0).toISOString(),
    })).rejects.toThrow(ConflictException);
  });
  it("rejects an expired scan and invalid retention", async () => {
    const { service, prisma } = api();
    await expect(service.scanPage(id, { asOf: "2020-01-01T00:00:00.000Z" }))
      .rejects.toThrow(BadRequestException);
    prisma.setting.findFirst.mockResolvedValue({ value: "-1" });
    await expect(service.scanPage(id, {})).rejects.toThrow(BadRequestException);
  });
  it("does not expose nonexistent subjects", async () => {
    await expect(api(null).service.scanPage(id, {})).rejects.toThrow(NotFoundException);
  });
});
