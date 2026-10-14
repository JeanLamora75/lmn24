import { BadRequestException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import { AuthService } from "../auth/auth.service";
import { HashtagStatisticsController } from "./hashtag-statistics.controller";
import { HashtagStatisticsService } from "./hashtag-statistics.service";

const request = { headers: { cookie: "lmn24_session=my-session" } };
const one = "11111111-1111-4111-8111-111111111111";
function fixture(role: string | null) {
  const getUserFromSession = vi.fn().mockResolvedValue(role ? { role } : null);
  const dashboard = vi.fn().mockResolvedValue({ indicators: {} });
  const controller = new HashtagStatisticsController(
    { dashboard } as unknown as HashtagStatisticsService,
    { getUserFromSession } as unknown as AuthService,
    { get: vi.fn().mockReturnValue("lmn24_session") } as unknown as ConfigService,
  );
  return { controller, getUserFromSession, dashboard };
}
describe("SCRUM-59 — ADMIN-only dashboard and bounded filters", () => {
  it("accepts allowed independent periods and max-five UUID selectors", async () => {
    const { controller, dashboard, getUserFromSession } = fixture("ADMIN");
    await controller.dashboard(request, { period: "30d", ids: one });
    expect(getUserFromSession).toHaveBeenCalledWith("my-session");
    expect(dashboard).toHaveBeenCalledWith("30d", [one]);
    await controller.dashboard(request, {});
    expect(dashboard).toHaveBeenCalledWith("7d", []);
  });
  it("blocks anonymous and non-ADMIN sessions", async () => {
    await expect(fixture(null).controller.dashboard(request, {}))
      .rejects.toThrow(UnauthorizedException);
    await expect(fixture("USER").controller.dashboard(request, {}))
      .rejects.toThrow(ForbiddenException);
  });
  it.each([
    { period: "90d" }, { period: "custom" },
    { period: "7d", countryId: one },
    { ids: "wrong" }, { ids: one + "," + one },
    { ids: Array(6).fill(one).join(",") },
  ])("rejects impossible filters and arbitrary selectors", async (query) => {
    const { controller, dashboard } = fixture("ADMIN");
    await expect(controller.dashboard(request, query))
      .rejects.toThrow(BadRequestException);
    expect(dashboard).not.toHaveBeenCalled();
  });
});
