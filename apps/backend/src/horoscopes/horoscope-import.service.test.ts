import { describe, expect, it, vi } from "vitest";
import { HoroscopeImportService } from "./horoscope-import.service";

const pgMock = vi.hoisted(() => ({
  connect: vi.fn(async () => undefined),
  query: vi.fn(async (sql: string) =>
    sql.includes("pg_try_advisory_lock")
      ? { rows: [{ acquired: true }] }
      : { rows: [{ pg_advisory_unlock: true }] }),
  end: vi.fn(async () => undefined),
  on: vi.fn(),
  off: vi.fn(),
}));
vi.mock("pg", () => ({
  Client: class {
    connect = pgMock.connect;
    query = pgMock.query;
    end = pgMock.end;
    on = pgMock.on;
    off = pgMock.off;
  },
}));

describe("Horoscope import PostgreSQL advisory lock", () => {
  it("uses a query that returns an integer, not PostgreSQL void", async () => {
    const query = vi.fn().mockResolvedValue([{acquired:1}]);
    const rows = vi.fn().mockResolvedValue([]);
    const created = vi.fn().mockResolvedValue({id:"snapshot-id",sourceFingerprint:"f"});
    const transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      $queryRaw: query,
      horoscope: {findMany:rows,createMany:vi.fn().mockResolvedValue({count:96})},
      horoscopeAstronomySnapshot: {findUnique:vi.fn().mockResolvedValue(null),create:created},
    }));
    const prisma = {
      horoscopeImportRun: {create:vi.fn().mockResolvedValue({id:"run-id"}),update:vi.fn()},
      $transaction:transaction,
    };
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost/test");
    const service = new HoroscopeImportService({prisma} as never,{get:()=>undefined} as never);
    const signs=["aries","taurus","gemini","cancer","leo","virgo","libra","scorpio","sagittarius","capricorn","aquarius","pisces"];
    const locales=["fr","en","de","es","pt","it","ru","nl"];
    const content=JSON.stringify({
      date:"2026-10-15",generatedAt:"2026-10-14T22:40:13.893621+02:00",timezone:"Europe/Paris",
      astronomy:{validationStatus:"PARTIAL",attribution:{text:"Astronomical data: CosmyDay",url:"https://cosmyday.com"}},
      horoscopes:signs.flatMap(sign=>locales.map(language=>({
        date:"2026-10-15",sign,language,general:"G",love:"L",work:"W",finance:"F",disclaimer:"D",
      }))),
    });
    const result=await service.importContent(content,"horoscopes-2026-10-15.json","11111111-1111-4111-8111-111111111111");
    expect(result).toMatchObject({inserted:96,skipped:0,status:"SUCCESS"});
    expect(pgMock.query).toHaveBeenCalledWith("SELECT pg_try_advisory_lock($1, $2) AS acquired", [241024, 85]);
    expect(pgMock.query).toHaveBeenCalledWith("SELECT pg_advisory_unlock($1, $2)", [241024, 85]);
    expect(query).toHaveBeenCalledOnce();
    const chunks=query.mock.calls[0]?.[0] as TemplateStringsArray;
    expect(chunks.join("")).toContain("SELECT 1 AS acquired FROM pg_advisory_xact_lock");
  });
});
