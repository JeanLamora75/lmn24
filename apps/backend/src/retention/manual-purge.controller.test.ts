import { ConfigService } from "@nestjs/config";
import { BadRequestException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AuthService } from "../auth/auth.service";
import { ManualPurgeController } from "./manual-purge.controller";
import { ManualPurgeService } from "./manual-purge.service";

function fixture(user: { id: string; role: string } | null) {
  const getUserFromSession = vi.fn().mockResolvedValue(user);
  const preview = vi.fn().mockResolvedValue({ token: "test" });
  const start = vi.fn().mockReturnValue({ status: "RUNNING" });
  const recentJobs = vi.fn().mockReturnValue([]);
  const controller = new ManualPurgeController(
    { preview, start, recentJobs } as unknown as ManualPurgeService,
    { getUserFromSession } as unknown as AuthService,
    { get: vi.fn().mockReturnValue("lmn24_session") } as unknown as ConfigService,
  );
  const request = { headers: { cookie: "lmn24_session=test-token" } };
  return { controller, request, preview, start, getUserFromSession };
}
describe("SCRUM-58 — ADMIN-only manual purge API", () => {
  it("authenticates preview, execution and job status", async () => {
    const { controller, request, preview, start } = fixture({ id: "admin", role: "ADMIN" });
    await controller.preview(request, "video", "expired");
    await controller.preview(request, "weather_current", "expired");
    await controller.preview(request, "weather_run", "all");
    const available=await controller.tables(request);
    expect(available.tables).toContain("weather_current");
    expect(available.tables).toContain("weather_run");
    expect(available.tables).not.toContain("weather_city");
    expect(preview).toHaveBeenCalledWith("admin", "video", "expired");
    await controller.execute(request, {
      table: "video", mode: "all", token: "ce759515-090c-4baa-bcc1-570c930c97e7",
      confirmed: true, typedName: "video",
    });
    expect(start).toHaveBeenCalledOnce();
    await controller.jobs(request);
  });
  it("blocks unauthenticated and non-admin users", async () => {
    for(const user of [null, { id: "u", role: "EDITOR" }]) {
      const { controller, request, preview, start } = fixture(user);
      await expect(controller.preview(request, "video", "expired"))
        .rejects.toThrow(user ? ForbiddenException : UnauthorizedException);
      await expect(controller.execute(request, {}))
        .rejects.toThrow(user ? ForbiddenException : UnauthorizedException);
      expect(preview).not.toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
    }
  });
  it("never accepts arbitrary table keys or forged confirmations", async () => {
    const { controller, request, start } = fixture({ id: "admin", role: "ADMIN" });
    await expect(controller.preview(request, "weather_city", "all"))
      .rejects.toThrow(BadRequestException);
    await expect(controller.preview(request, "app_user", "all"))
      .rejects.toThrow(BadRequestException);
    await expect(controller.execute(request, {
      table: "app_user", mode: "all", confirmed: true,
      token: "ce759515-090c-4baa-bcc1-570c930c97e7",
    })).rejects.toThrow(BadRequestException);
    await expect(controller.execute(request, {
      table: "video", mode: "all", confirmed: false,
      token: "ce759515-090c-4baa-bcc1-570c930c97e7",
    })).rejects.toThrow(BadRequestException);
    await expect(controller.execute(request, {
      table: "weather_city", mode: "all", confirmed: true,
      token: "ce759515-090c-4baa-bcc1-570c930c97e7",
      typedName:"weather_city",
    })).rejects.toThrow(BadRequestException);
    expect(start).not.toHaveBeenCalled();
  });
});
