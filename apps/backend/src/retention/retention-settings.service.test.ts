import {
  BadRequestException, ConflictException, ServiceUnavailableException,
} from "@nestjs/common";
import { RETENTION_DEFAULTS, RETENTION_SETTING_KEYS } from "@lmn24/contracts";
import { describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../database/database.service";
import { RetentionSettingsService } from "./retention-settings.service";

function fixture(options?: {
  missing?: string; wrongType?: string; current?: string; updateCount?: number;
}) {
  const findMany = vi.fn().mockResolvedValue(RETENTION_SETTING_KEYS
    .filter((key) => key !== options?.missing)
    .map((key) => ({
      key, value: String(RETENTION_DEFAULTS[key]),
      type: key === options?.wrongType ? "STRING" : "INTEGER",
    })));
  const findFirst = vi.fn().mockResolvedValue(options?.missing
    ? null : { value: options?.current ?? "60", type: options?.wrongType ? "STRING" : "INTEGER" });
  const updateMany = vi.fn().mockResolvedValue({ count: options?.updateCount ?? 1 });
  const prisma = { setting: { findMany, findFirst, updateMany } };
  return {
    service: new RetentionSettingsService({ prisma } as unknown as DatabaseService),
    findMany, findFirst, updateMany,
  };
}

describe("SCRUM-56 — eight independent retention settings", () => {
  it("reads all eight global INTEGER values without substituting defaults", async () => {
    const { service, findMany } = fixture();
    await expect(service.getAll()).resolves.toEqual({ values: RETENTION_DEFAULTS });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        scope: "GLOBAL", scopeId: null, key: { in: [...RETENTION_SETTING_KEYS] },
      },
      select: { key: true, value: true, type: true },
    });
  });

  it("rejects missing or mistyped seeded rows instead of pretending the settings exist", async () => {
    await expect(fixture({ missing: "retentionVideosDays" }).service.getAll())
      .rejects.toThrow(ServiceUnavailableException);
    await expect(fixture({ wrongType: "retentionBackendLogsDays" }).service.getAll())
      .rejects.toThrow(ServiceUnavailableException);
    await expect(fixture({ current: "-2" }).service.updateOne({
      key: "retentionArticlesDays", days: 40, expectedDays: 60, confirmDecrease: true,
    })).rejects.toThrow(ServiceUnavailableException);
  });

  it("updates only one setting without changing unrelated rows or deleting anything", async () => {
    const { service, findFirst, updateMany } = fixture();
    await expect(service.updateOne({
      key: "retentionArticlesDays", days: 90, expectedDays: 60, confirmDecrease: false,
    })).resolves.toEqual({ key: "retentionArticlesDays", days: 90 });
    expect(findFirst).toHaveBeenCalledWith({
      where: { key: "retentionArticlesDays", scope: "GLOBAL", scopeId: null },
      select: { value: true, type: true },
    });
    expect(updateMany).toHaveBeenCalledOnce();
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        key: "retentionArticlesDays", scope: "GLOBAL", scopeId: null,
        type: "INTEGER", value: "60",
      },
      data: { value: "90" },
    });
  });

  it.each([
    { key: "someOtherSetting", days: 1, expectedDays: 60, confirmDecrease: false },
    { key: "retentionArticlesDays", days: 0, expectedDays: 60, confirmDecrease: true },
    { key: "retentionArticlesDays", days: -1, expectedDays: 60, confirmDecrease: true },
    { key: "retentionArticlesDays", days: 1.5, expectedDays: 60, confirmDecrease: true },
    { key: "retentionArticlesDays", days: 3651, expectedDays: 60, confirmDecrease: true },
    { key: "retentionArticlesDays", days: 90, expectedDays: 0, confirmDecrease: false },
  ])("rejects unknown keys and invalid duration: $key, $days", async (input) => {
    const { service, findFirst, updateMany } = fixture();
    await expect(service.updateOne(input)).rejects.toThrow(BadRequestException);
    expect(findFirst).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation for reductions, including when called directly via API", async () => {
    const { service, updateMany } = fixture();
    await expect(service.updateOne({
      key: "retentionArticlesDays", days: 30, expectedDays: 60, confirmDecrease: false,
    })).rejects.toThrow(BadRequestException);
    expect(updateMany).not.toHaveBeenCalled();
    await expect(service.updateOne({
      key: "retentionArticlesDays", days: 30, expectedDays: 60, confirmDecrease: true,
    })).resolves.toMatchObject({ days: 30 });
  });

  it("rejects stale form state before updating, and concurrent changes at write time", async () => {
    const stale = fixture();
    await expect(stale.service.updateOne({
      key: "retentionArticlesDays", days: 90, expectedDays: 55, confirmDecrease: false,
    })).rejects.toThrow(ConflictException);
    expect(stale.updateMany).not.toHaveBeenCalled();
    const concurrent = fixture({ updateCount: 0 });
    await expect(concurrent.service.updateOne({
      key: "retentionArticlesDays", days: 90, expectedDays: 60, confirmDecrease: false,
    })).rejects.toThrow(ConflictException);
  });

  it("does not write if the value has not changed", async () => {
    const { service, updateMany } = fixture();
    await expect(service.updateOne({
      key: "retentionArticlesDays", days: 60, expectedDays: 60, confirmDecrease: false,
    })).resolves.toEqual({ key: "retentionArticlesDays", days: 60 });
    expect(updateMany).not.toHaveBeenCalled();
  });
});
