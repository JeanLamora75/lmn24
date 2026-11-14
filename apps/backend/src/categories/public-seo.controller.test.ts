import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../database/database.service";
import { PublicSeoController } from "./public-seo.controller";

function setup() {
  const category = { count: vi.fn().mockResolvedValue(1), findMany: vi.fn().mockResolvedValue([
    {slug:"international",updatedAt:new Date("2026-11-01T09:00:00Z")},
  ]) };
  const source = { count: vi.fn().mockResolvedValue(1), findMany: vi.fn().mockResolvedValue([
    {slug:"public-source",updatedAt:new Date("2026-11-01T09:00:00Z")},
  ]) };
  const hashtag = { count: vi.fn().mockResolvedValue(1), findMany: vi.fn().mockResolvedValue([
    {slug:"world",updatedAt:new Date("2026-11-01T09:00:00Z")},
  ]) };
  const controller = new PublicSeoController({
    prisma: { category, source, hashtag },
  } as unknown as DatabaseService);
  return {controller, category, source, hashtag};
}

describe("SCRUM-94 SEO discovery", () => {
  it("counts only active categories and sources with public articles in their language", async () => {
    const {controller,category,source,hashtag} = setup();
    const result = await controller.counts();
    expect(result.pageSize).toBe(1000);
    expect(result.results).toHaveLength(24);
    expect(category.count).toHaveBeenCalledWith({where:{
      isActive:true, articles:{some:{languageIsoCode2:"fr",source:{isActive:true}}},
    }});
    expect(source.count).toHaveBeenCalledWith({where:{
      isActive:true, articles:{some:{languageIsoCode2:"nl",category:{isActive:true}}},
    }});
    expect(hashtag.count).toHaveBeenCalledWith({where:{isActive:true}});
  });
  it("only exports public slugs, with a bounded page size and the persistent update timestamp", async () => {
    const {controller,source} = setup();
    const result = await controller.items("sources", "en", "2");
    expect(source.findMany).toHaveBeenCalledWith({
      where: {isActive:true,articles:{some:{languageIsoCode2:"en",category:{isActive:true}}}},
      select:{slug:true,updatedAt:true},orderBy:{slug:"asc"},skip:2000,take:1000,
    });
    expect(result.items).toEqual([{slug:"public-source",lastModified:"2026-11-01T09:00:00.000Z"}]);
  });
  it("does not emit invalid slugs or private records", async () => {
    const {controller,hashtag} = setup();
    hashtag.findMany.mockResolvedValueOnce([
      {slug:"safe-slug",updatedAt:new Date("2026-11-01T00:00:00Z")},
      {slug:"../admin",updatedAt:new Date("2026-11-01T00:00:00Z")},
    ]);
    const result = await controller.items("hashtags","fr","0");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.slug).toBe("safe-slug");
    expect(hashtag.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{isActive:true}}));
  });
  it("rejects invalid locale, kind and unbounded page requests", async () => {
    const {controller} = setup();
    await expect(controller.items("sources","zz","0")).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.items("admin","fr","0")).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.items("sources","fr","10000")).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.items("sources","fr","-1")).rejects.toBeInstanceOf(BadRequestException);
  });
});
