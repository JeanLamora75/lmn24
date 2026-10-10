import { describe, expect, it, vi } from "vitest";

import { DatabaseService } from "../database/database.service";
import { FeedsService } from "./feeds.service";

describe("SCRUM-14/SCRUM-20 — filtre exact depuis le compteur de flux", () => {
  it("ne mélange pas des journaux aux noms similaires", async () => {
    const sourceId = "11111111-1111-4111-8111-111111111111";
    const count = vi.fn().mockResolvedValue(2);
    const findMany = vi.fn().mockResolvedValue([]);
    const feeds = new FeedsService({
      prisma: { feed: { count, findMany } },
    } as unknown as DatabaseService);
    await feeds.list({
      sourceId, status: "all", page: 1, pageSize: 10,
    });
    expect(count).toHaveBeenCalledWith({ where: { sourceId } });
    expect(findMany.mock.calls[0]?.[0].where).toEqual({ sourceId });
  });

  it("conserve les filtres de statut, langue et catégorie si une source est sélectionnée", async () => {
    const sourceId = "11111111-1111-4111-8111-111111111111";
    const categoryId = "22222222-2222-4222-8222-222222222222";
    const findMany = vi.fn().mockResolvedValue([]);
    const feeds = new FeedsService({
      prisma: {
        feed: { count: vi.fn().mockResolvedValue(0), findMany },
      },
    } as unknown as DatabaseService);
    await feeds.list({
      sourceId, language: "fr", categoryId, status: "active", page: 1, pageSize: 10,
    });
    expect(findMany.mock.calls[0]?.[0].where).toEqual({
      sourceId, languageIsoCode2: "fr", categoryId, isActive: true,
    });
  });
});
