import { afterEach, describe, expect, it, vi } from "vitest";

const session = vi.fn();
const configured = vi.fn();
const report = vi.fn();
vi.mock("@/lib/admin-auth", () => ({getAdminSession:session}));
vi.mock("@/lib/search-console", () => ({
  isSearchConsoleConfigured:configured, getSearchConsoleReport:report,
}));
import { GET } from "./route";

afterEach(()=>{vi.resetAllMocks();});

describe("SCRUM-101 Search Console admin endpoint",()=>{
  it("requires a valid admin session before checking configuration or calling Google",async()=>{
    session.mockResolvedValue(null);
    const response=await GET(new Request("https://www.lmn24.com/api/admin/statistics/search-console?period=7d"));
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(configured).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });
  it("requires an explicit valid reporting period",async()=>{
    session.mockResolvedValue({id:"user"});
    configured.mockReturnValue(true);
    const response=await GET(new Request("https://www.lmn24.com/api/admin/statistics/search-console?period=90d"));
    expect(response.status).toBe(400);
    expect(report).not.toHaveBeenCalled();
  });
  it("returns configuration unavailable without exposing any secret",async()=>{
    session.mockResolvedValue({id:"user"});
    configured.mockReturnValue(false);
    const response=await GET(new Request("https://www.lmn24.com/api/admin/statistics/search-console?period=30d"));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({configured:false});
  });
  it("returns only read-only performance statistics and sitemap health",async()=>{
    session.mockResolvedValue({id:"user"});
    configured.mockReturnValue(true);
    report.mockResolvedValue({property:"https://www.lmn24.com/",period:30,rows:[],
      totalClicks:0,totalImpressions:0,averageCtr:0,averagePosition:null,
      sitemap:null,sitemapStatus:"missing"});
    const response=await GET(new Request("https://www.lmn24.com/api/admin/statistics/search-console?period=30d"));
    expect(response.status).toBe(200);
    expect(report).toHaveBeenCalledWith(30);
    expect(await response.json()).toMatchObject({configured:true,totalClicks:0,sitemapStatus:"missing"});
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("sanitizes Google permission errors and does not leak Google response or private credentials",async()=>{
    session.mockResolvedValue({id:"user"});
    configured.mockReturnValue(true);
    report.mockRejectedValue(new Error("GSC_PERMISSION_DENIED"));
    const error=vi.spyOn(console,"error").mockImplementation(()=>{});
    try {
      const response=await GET(new Request("https://www.lmn24.com/api/admin/statistics/search-console?period=7d"));
      expect(response.status).toBe(502);
      const data=await response.json();
      expect(data.code).toBe("GSC_PERMISSION_DENIED");
      expect(JSON.stringify(data)).not.toContain("private_key");
    } finally {error.mockRestore();}
  });
});
