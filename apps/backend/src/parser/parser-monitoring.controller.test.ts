import { BadRequestException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import { AuthService } from "../auth/auth.service";
import { ParserMonitoringController } from "./parser-monitoring.controller";
import { ParserMonitoringService } from "./parser-monitoring.service";

const req = { headers: { cookie: "lmn24_session=token-123" } };
const id = "11111111-1111-4111-8111-111111111111";
function setup(role: string | null) {
  const getUserFromSession = vi.fn().mockResolvedValue(role ? { role } : null);
  const monitoring = {
    summary: vi.fn().mockResolvedValue({ total: 0 }),
    runs: vi.fn().mockResolvedValue({ rows: [] }),
    batches: vi.fn().mockResolvedValue({ rows: [] }),
    runDetail: vi.fn().mockResolvedValue({ id }),
    events: vi.fn().mockResolvedValue({ rows: [] }),
    alerts: vi.fn().mockResolvedValue({ rows: [] }),
    exportCsv: vi.fn().mockResolvedValue("header;body"),
  };
  const controller = new ParserMonitoringController(
    monitoring as unknown as ParserMonitoringService,
    { getUserFromSession } as unknown as AuthService,
    { get: vi.fn().mockReturnValue("lmn24_session") } as unknown as ConfigService,
  );
  return { controller, monitoring, getUserFromSession };
}
describe("SCRUM-60 — secured and bounded monitoring endpoints", () => {
  it("reads every monitoring view and CSV for ADMIN", async () => {
    const { controller, monitoring, getUserFromSession } = setup("ADMIN");
    await controller.summary(req, { parser: "INFOS", period: "24h" });
    await controller.runs(req, { parser: "VIDEOS", pageSize: "50" });
    await controller.batches(req, {});
    await controller.runDetail(req, "INFOS", id);
    await controller.events(req, id, { page: "1", errorsOnly: "true" });
    await controller.alerts(req, {});
    await controller.exportCsv(req, {});
    expect(monitoring.exportCsv).toHaveBeenCalledOnce();
    expect(monitoring.runDetail).toHaveBeenCalledWith(id, "INFOS");
    expect(monitoring.events).toHaveBeenCalledWith(id, 1, 20, true);
    expect(getUserFromSession).toHaveBeenCalledWith("token-123");
  });
  it.each([null, "USER"])("rejects anonymous/non-admin access: %s", async role => {
    const { controller, monitoring } = setup(role);
    const type = role ? ForbiddenException : UnauthorizedException;
    await expect(controller.summary(req, {})).rejects.toThrow(type);
    await expect(controller.exportCsv(req, {})).rejects.toThrow(type);
    await expect(controller.events(req, id, {})).rejects.toThrow(type);
    expect(monitoring.summary).not.toHaveBeenCalled();
  });
  it.each([
    { period: "1year" }, { parser: "NOT_A_PARSER" },
    { pageSize: "500" }, { page: "501" }, { language: "french" },
    { status: "DROP_TABLE" }, { unrelated: "source" },
  ])("rejects invalid filters and unbounded paging", async query => {
    const { controller, monitoring } = setup("ADMIN");
    await expect(controller.runs(req, query)).rejects.toThrow(BadRequestException);
    expect(monitoring.runs).not.toHaveBeenCalled();
  });
  it("rejects forged IDs or parser types for run/event details", async () => {
    const { controller, monitoring } = setup("ADMIN");
    await expect(controller.runDetail(req, "ALL", id)).rejects.toThrow(BadRequestException);
    await expect(controller.events(req, "invalid", {})).rejects.toThrow(BadRequestException);
    expect(monitoring.runDetail).not.toHaveBeenCalled();
  });
});
