import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { PublicHoroscopesController } from "./public-horoscopes.controller";
import { horoscopeWindow, parisToday } from "./public-horoscopes.service";

describe("public horoscopes", () => {
  it("uses the Paris civil day across the DST transition", () => {
    expect(parisToday(new Date("2026-03-28T23:30:00.000Z"))).toBe("2026-03-29");
    expect(horoscopeWindow(new Date("2026-03-28T23:30:00.000Z"))).toHaveLength(8);
    expect(horoscopeWindow(new Date("2026-03-28T23:30:00.000Z"))[7]).toBe("2026-04-05");
  });
  it("rejects an unknown sign or locale", async () => {
    const service = { get: vi.fn() };
    const controller = new PublicHoroscopesController(service as never);
    await expect(controller.get("unknown", "fr")).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.get("aries", "xx")).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.get("aries", "fr", "2024-01-01")).rejects.toBeInstanceOf(BadRequestException);
    expect(service.get).not.toHaveBeenCalled();
  });
  it("defaults to today's Paris date", async () => {
    const service = { get: vi.fn().mockResolvedValue({ available: false }) };
    const controller = new PublicHoroscopesController(service as never);
    await controller.get("leo", "fr");
    expect(service.get).toHaveBeenCalledWith("leo", "fr", horoscopeWindow()[0]);
  });
});
