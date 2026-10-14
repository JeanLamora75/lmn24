import {
  BadRequestException, ForbiddenException, UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import { AuthService } from "../auth/auth.service";
import { RetentionSettingsController } from "./retention-settings.controller";
import { RetentionSettingsService } from "./retention-settings.service";

const admin = { role: "ADMIN" };
const request = { headers: { cookie: "lmn24_session=test-token; other=value" } };
const valid = {
  key: "retentionArticlesDays", days: 90, expectedDays: 60, confirmDecrease: false,
};

function controller(user: unknown) {
  const getUserFromSession = vi.fn().mockResolvedValue(user);
  const getAll = vi.fn().mockResolvedValue({ values: {} });
  const updateOne = vi.fn().mockResolvedValue({ key: valid.key, days: 90 });
  const service = { getAll, updateOne };
  const config = { get: vi.fn().mockReturnValue("lmn24_session") };
  return {
    controller: new RetentionSettingsController(
      service as unknown as RetentionSettingsService,
      { getUserFromSession } as unknown as AuthService,
      config as unknown as ConfigService,
    ),
    getUserFromSession, getAll, updateOne,
  };
}

describe("SCRUM-56 — admin-only retention API", () => {
  it("allows authenticated ADMIN to read and update one duration", async () => {
    const mock = controller(admin);
    await mock.controller.list(request);
    await mock.controller.update(request, valid);
    expect(mock.getUserFromSession).toHaveBeenCalledWith("test-token");
    expect(mock.getAll).toHaveBeenCalledOnce();
    expect(mock.updateOne).toHaveBeenCalledWith(valid);
  });

  it("blocks anonymous GET and PATCH", async () => {
    const mock = controller(null);
    await expect(mock.controller.list(request)).rejects.toThrow(UnauthorizedException);
    await expect(mock.controller.update(request, valid)).rejects.toThrow(UnauthorizedException);
    expect(mock.getAll).not.toHaveBeenCalled();
    expect(mock.updateOne).not.toHaveBeenCalled();
  });

  it("blocks non-admin GET and PATCH", async () => {
    const mock = controller({ role: "USER" });
    await expect(mock.controller.list(request)).rejects.toThrow(ForbiddenException);
    await expect(mock.controller.update(request, valid)).rejects.toThrow(ForbiddenException);
    expect(mock.updateOne).not.toHaveBeenCalled();
  });

  it.each([
    { ...valid, days: 0 }, { ...valid, days: -1 }, { ...valid, days: 0.5 },
    { ...valid, days: "60" }, { ...valid, extra: "unknown" },
    { ...valid, confirmDecrease: "yes" },
  ])("rejects malformed or extended JSON bodies", async (body) => {
    const mock = controller(admin);
    await expect(mock.controller.update(request, body)).rejects.toThrow(BadRequestException);
    expect(mock.updateOne).not.toHaveBeenCalled();
  });
});
