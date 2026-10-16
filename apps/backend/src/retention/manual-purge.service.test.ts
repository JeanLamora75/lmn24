import { BadRequestException, ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../database/database.service";
import { HashtagTrendsService } from "../hashtags/hashtag-trends.service";
import { RetentionSettingsService } from "./retention-settings.service";
import { ManualPurgeService } from "./manual-purge.service";

vi.mock("@lmn24/database", () => ({
  rebuildHashtagHourlyCounts: vi.fn().mockResolvedValue({ countedBuckets: 0 }),
}));

const admin = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const days = {
  retentionArticlesDays: 60,
  retentionVideosDays: 60,
  retentionHoroscopesDays: 30,
  retentionInfoParserRunsDays: 14,
  retentionVideoParserRunsDays: 14,
  retentionInfoParserLogsDays: 7,
  retentionVideoParserLogsDays: 7,
  retentionBackendLogsDays: 7,
  retentionHashtagHourlyCountsDays: 60,
  weatherCurrentRetentionDays: 7,
  weatherRunRetentionDays: 14,
};

function harness(count = 2) {
  const records = [{ id: "a" }, { id: "b" }];
  const deleteMany = vi.fn().mockResolvedValue({ count });
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ acquired: true }]),
    setting: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
    hashtagHourlyCount: {
      deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      count: vi.fn().mockResolvedValue(count),
      findMany: vi.fn().mockResolvedValue([]),
    },
    article: { count: vi.fn().mockResolvedValue(count), findMany: vi.fn().mockResolvedValueOnce(records).mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({ count }) },
    horoscope: { count: vi.fn().mockResolvedValue(count), findMany: vi.fn().mockResolvedValueOnce(records).mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({ count }) },
    horoscopeAstronomySnapshot: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    video: { count: vi.fn().mockResolvedValue(count), findMany: vi.fn().mockResolvedValueOnce(records).mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({ count }) },
    feedRun: { count: vi.fn().mockResolvedValue(count), findMany: vi.fn().mockResolvedValueOnce(records).mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({ count }) },
    feedVideoRun: { count: vi.fn().mockResolvedValue(count), findMany: vi.fn().mockResolvedValueOnce(records).mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({ count }) },
    weatherCurrent: {
      count: vi.fn().mockResolvedValue(count),
      findMany: vi.fn().mockResolvedValueOnce([{ cityId: "11111111-1111-4111-8111-111111111111" },
        { cityId: "22222222-2222-4222-8222-222222222222" }]).mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count }),
    },
    weatherRun: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValueOnce(records).mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count }),
    },
    weatherCity: { deleteMany: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (db: typeof tx) => Promise<number>) => callback(tx)),
    article: { count: vi.fn().mockResolvedValue(count) },
    horoscope: { count: vi.fn().mockResolvedValue(count) },
    video: { count: vi.fn().mockResolvedValue(count) },
    feedRun: { count: vi.fn().mockResolvedValue(count) },
    feedVideoRun: { count: vi.fn().mockResolvedValue(count) },
    weatherCurrent: { count: vi.fn().mockResolvedValue(count) },
    weatherRun: { count: vi.fn().mockResolvedValue(count) },
    hashtagHourlyCount: { count: vi.fn().mockResolvedValue(count) },
  };
  const retention = { getAll: vi.fn().mockResolvedValue({ values: days }) };
  const trends = { invalidate: vi.fn() };
  const service = new ManualPurgeService(
    { prisma } as unknown as DatabaseService,
    retention as unknown as RetentionSettingsService,
    trends as unknown as HashtagTrendsService,
  );
  return { service, prisma, tx, deleteMany, retention, trends };
}

async function done(service: ManualPurgeService) {
  await vi.waitFor(() => {
    expect(["COMPLETED", "ERROR"]).toContain(service.recentJobs()[0]?.status);
  });
  return service.recentJobs()[0]!;
}
describe("SCRUM-58 — safe preview and manual purge", () => {
  it("only previews expiration and does not delete rows on GET", async () => {
    const { service, prisma, retention } = harness();
    const p = await service.preview(admin, "article", "expired");
    expect(p.count).toBe(2);
    expect(new Date(p.cutoff!).getTime()).toBeLessThan(Date.now());
    expect(retention.getAll).toHaveBeenCalledOnce();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects unconfirmed full purge, cross-user token, and replay", async () => {
    const { service } = harness();
    const p = await service.preview(admin, "video", "all");
    expect(() => service.start(other, {
      table: "video", mode: "all", token: p.token, confirmed: true, typedName: "video",
    })).toThrow(BadRequestException);
    expect(() => service.start(admin, {
      table: "video", mode: "all", token: p.token, confirmed: true, typedName: "article",
    })).toThrow(BadRequestException);
    expect(() => service.start(admin, {
      table: "video", mode: "all", token: p.token, confirmed: false, typedName: "video",
    })).toThrow(BadRequestException);
    const job = service.start(admin, {
      table: "video", mode: "all", token: p.token, confirmed: true, typedName: "video",
    });
    expect(job.status).toBe("RUNNING");
    await done(service);
    expect(() => service.start(admin, {
      table: "video", mode: "all", token: p.token, confirmed: true, typedName: "video",
    })).toThrow(BadRequestException);
  });

  it("purges exactly the selected video table in batches", async () => {
    const { service, tx } = harness();
    const p = await service.preview(admin, "video", "all");
    service.start(admin, { table: "video", mode: "all",
      token: p.token, confirmed: true, typedName: "video" });
    const finished = await done(service);
    expect(finished.status).toBe("COMPLETED");
    expect(finished.deleted).toBe(2);
    expect(tx.video.deleteMany).toHaveBeenCalledOnce();
    expect(tx.article.deleteMany).not.toHaveBeenCalled();
    expect(tx.feedRun.deleteMany).not.toHaveBeenCalled();
    expect(tx.hashtagHourlyCount.deleteMany).not.toHaveBeenCalled();
  });

  it("protects RUNNING parser history even in all mode", async () => {
    const { service, tx } = harness();
    const p = await service.preview(admin, "feed_run", "all");
    service.start(admin, { table: "feed_run", mode: "all", token: p.token,
      confirmed: true, typedName: "feed_run" });
    await done(service);
    expect(tx.feedRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { not: "RUNNING" } },
    }));
    expect(tx.feedRun.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ["a", "b"] }, status: { not: "RUNNING" } },
    }));
  });

  it("invalidates hashtag counters before deleting articles within a transaction", async () => {
    const { service, tx, trends } = harness();
    const p = await service.preview(admin, "article", "expired");
    service.start(admin, { table: "article", mode: "expired",
      token: p.token, confirmed: true });
    await done(service);
    expect(tx.hashtagHourlyCount.deleteMany).toHaveBeenCalledWith({});
    expect(tx.setting.deleteMany).toHaveBeenCalled();
    expect(tx.article.deleteMany).toHaveBeenCalled();
    expect(trends.invalidate).toHaveBeenCalled();
  });

  it("refuses to continue when candidates have changed since preview", async () => {
    const { service, tx } = harness();
    const p = await service.preview(admin, "video", "all");
    tx.video.count.mockResolvedValue(3);
    service.start(admin, { table: "video", mode: "all", token: p.token,
      confirmed: true, typedName: "video" });
    const result = await done(service);
    expect(result.status).toBe("ERROR");
    expect(result.message).toContain("changé");
    expect(tx.video.deleteMany).not.toHaveBeenCalled();
  });

  it("serializes concurrent purge attempts", async () => {
    const { service, prisma } = harness();
    let resume: (() => void) | undefined;
    prisma.$transaction.mockImplementationOnce(async () => {
      await new Promise<void>(resolve => { resume = resolve; });
      return 2;
    });
    const p = await service.preview(admin, "video", "all");
    service.start(admin, { table: "video", mode: "all",
      token: p.token, confirmed: true, typedName: "video" });
    await expect(service.preview(admin, "article", "all"))
      .rejects.toThrow(ConflictException);
    resume?.();
    await done(service);
  });
});

describe("SCRUM-65 — horoscope purge", () => {
  it("previews expired horoscope rows using a DATE cutoff", async () => {
    const { service, prisma } = harness();
    const preview = await service.preview(admin, "horoscope", "expired");
    expect(preview.count).toBe(2);
    expect(preview.cutoff).toMatch(/T00:00:00\.000Z$/);
    expect(prisma.horoscope.count).toHaveBeenCalledWith({
      where: { date: { lt: new Date(preview.cutoff!) } },
    });
  });
  it("purges only horoscopes and orphan snapshots, not import history", async () => {
    const { service, tx } = harness();
    const preview = await service.preview(admin, "horoscope", "all");
    service.start(admin, {table:"horoscope",mode:"all",token:preview.token,
      confirmed:true,typedName:"horoscope"});
    const job = await done(service);
    expect(job.status).toBe("COMPLETED");
    expect(job.deleted).toBe(2);
    expect(tx.horoscope.deleteMany).toHaveBeenCalledOnce();
    expect(tx.horoscopeAstronomySnapshot.deleteMany).toHaveBeenCalledWith({
      where:{horoscopes:{none:{}}},
    });
    expect(tx.article.deleteMany).not.toHaveBeenCalled();
    expect(tx.video.deleteMany).not.toHaveBeenCalled();
  });
});

describe("SCRUM-78 — meteorological data purge", () => {
  it("offers expired weather observation preview using observed_at and 7-day retention", async () => {
    const { service, prisma, retention, tx } = harness();
    const p=await service.preview(admin,"weather_current","expired");
    expect(p.count).toBe(2);
    expect(new Date(p.cutoff!).getTime()).toBeLessThan(Date.now()-6*86400_000);
    expect(prisma.weatherCurrent.count).toHaveBeenCalledWith({
      where:{observedAt:{lt:new Date(p.cutoff!)}},
    });
    expect(retention.getAll).toHaveBeenCalledOnce();
    expect(tx.weatherCurrent.deleteMany).not.toHaveBeenCalled();
  });

  it("purges weather_current ONLY and never touches weather_city or other tables",async()=>{
    const {service,tx}=harness();
    const p=await service.preview(admin,"weather_current","all");
    service.start(admin,{table:"weather_current",mode:"all",token:p.token,confirmed:true,
      typedName:"weather_current"});
    const job=await done(service);
    expect(job.status).toBe("COMPLETED");
    expect(job.deleted).toBe(2);
    expect(tx.weatherCurrent.deleteMany).toHaveBeenCalledWith({
      where:{cityId:{in:[
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ]}},
    });
    expect(tx.weatherCity.deleteMany).not.toHaveBeenCalled();
    expect(tx.weatherRun.deleteMany).not.toHaveBeenCalled();
    expect(tx.article.deleteMany).not.toHaveBeenCalled();
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2); // global purge + weather parser lock
  });

  it("preserves RUNNING executions by construction, including all mode",async()=>{
    const {service,tx}=harness();
    const p=await service.preview(admin,"weather_run","all");
    service.start(admin,{table:"weather_run",mode:"all",token:p.token,confirmed:true,
      typedName:"weather_run"});
    const job=await done(service);
    expect(job.status).toBe("COMPLETED");
    expect(tx.weatherRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where:{status:{not:"RUNNING"}},
    }));
    expect(tx.weatherRun.deleteMany).toHaveBeenCalledWith({
      where:{id:{in:["a","b"]},status:{not:"RUNNING"}},
    });
    expect(tx.weatherCurrent.deleteMany).not.toHaveBeenCalled();
    expect(tx.weatherCity.deleteMany).not.toHaveBeenCalled();
  });

  it("refuses all weather purges while a parser execution is RUNNING",async()=>{
    for(const table of ["weather_current","weather_run"] as const){
      const {service,tx}=harness();
      tx.weatherRun.count.mockResolvedValue(1);
      const p=await service.preview(admin,table,"all");
      service.start(admin,{table,mode:"all",token:p.token,confirmed:true,typedName:table});
      const job=await done(service);
      expect(job.status).toBe("ERROR");
      expect(job.message).toContain("Collecte météo en cours");
      expect(tx.weatherCurrent.deleteMany).not.toHaveBeenCalled();
      expect(tx.weatherRun.deleteMany).not.toHaveBeenCalled();
      expect(tx.weatherCity.deleteMany).not.toHaveBeenCalled();
    }
  });

  it("requires a matching owner-bound preview token and confirmation for weather",async()=>{
    const {service}=harness();
    const p=await service.preview(admin,"weather_run","all");
    expect(()=>service.start(other,{table:"weather_run",mode:"all",token:p.token,
      confirmed:true,typedName:"weather_run"})).toThrow(BadRequestException);
    expect(()=>service.start(admin,{table:"weather_run",mode:"all",token:p.token,
      confirmed:true,typedName:"weather_city"})).toThrow(BadRequestException);
    expect(()=>service.start(admin,{table:"weather_run",mode:"all",token:p.token,
      confirmed:false,typedName:"weather_run"})).toThrow(BadRequestException);
  });
});
