import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { PublicWeatherController } from "./public-weather.controller";
import { PublicWeatherService } from "./public-weather.service";

describe("SCRUM-73 — public GET /weather", () => {
  const list = vi.fn(async (continent: string) => ({ continent, items: [] }));
  const controller = new PublicWeatherController({ list } as unknown as PublicWeatherService);

  it("defaults to EU, requires no session, and accepts all six continents", async () => {
    await expect(controller.list({})).resolves.toEqual({ continent: "EU", items: [] });
    for (const continent of ["EU", "AS", "AF", "NA", "SA", "OC"]) {
      await expect(controller.list({ continent }))
        .resolves.toEqual({ continent, items: [] });
    }
    expect(list).toHaveBeenCalledWith("EU");
    expect(list).toHaveBeenCalledWith("OC");
  });

  it.each([
    { continent: "XX" },
    { continent: "eu" },
    { continent: ["EU", "AS"] },
    { continent: "" },
    { search: "abc" },
    { continent: "EU", internal: "true" },
  ])("returns a client error on unsupported query parameters", async query => {
    await expect(controller.list(query))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
