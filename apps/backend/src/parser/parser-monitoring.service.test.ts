import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { monitoringRange, safeCsvCell } from "./parser-monitoring.service";

const base = { parser: "ALL" as const, period: "24h" as const, page: 1, pageSize: 20 };
describe("SCRUM-60 — monitoring reporting constraints", () => {
  it("calculates bounded UTC windows and half-open intervals for both parsers", () => {
    const now = new Date("2026-10-14T14:22:00Z");
    const { from, to } = monitoringRange(base, now);
    expect(from.toISOString()).toBe("2026-10-13T14:22:00.000Z");
    expect(to.toISOString()).toBe("2026-10-14T14:22:00.000Z");
    const custom = monitoringRange({ ...base, period: "custom",
      from: "2026-10-10", to: "2026-10-12" }, now);
    expect(custom.from.toISOString()).toBe("2026-10-10T00:00:00.000Z");
    expect(custom.to.toISOString()).toBe("2026-10-13T00:00:00.000Z");
  });
  it.each([
    { period: "custom" as const },
    { period: "custom" as const, from: "2026-10-14", to: "2026-10-12" },
    { period: "custom" as const, from: "2025-01-01", to: "2026-10-10" },
    { period: "custom" as const, from: "2099-10-10", to: "2099-10-11" },
  ])("rejects incomplete, reversed and huge windows", query => {
    expect(() => monitoringRange({ ...base, ...query },
      new Date("2026-10-14T14:22:00Z"))).toThrow(BadRequestException);
  });
  it("protects CSV from formula injection and quotes URLs safely", () => {
    expect(safeCsvCell("=HYPERLINK(\"https://evil\")"))
      .toBe("\"'=HYPERLINK(\"\"https://evil\"\")\"");
    expect(safeCsvCell("@SUM(A1)")).toBe("\"'@SUM(A1)\"");
    expect(safeCsvCell("+1")).toBe("\"'+1\"");
    expect(safeCsvCell("Safe;line\nnext")).toBe("\"Safe;line next\"");
  });
});
