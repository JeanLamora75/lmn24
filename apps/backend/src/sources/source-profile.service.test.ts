import { describe, expect, it, vi } from "vitest";

import { DatabaseService } from "../database/database.service";
import { SourceMediaService } from "./source-media.service";
import { SourcesService, type SourceInput } from "./sources.service";

const sourceId = "11111111-1111-4111-8111-111111111111";
const input: SourceInput = {
  name: "Journal", slug: "journal", websiteUrl: "https://journal.example.org",
  countryIsoCode2: "FR", isActive: true, logoUrl: null,
};

function setup(found?: Record<string, unknown>) {
  const country = { findUnique: vi.fn().mockResolvedValue({ id: "country-1" }) };
  const source = {
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(found ?? { id: sourceId, logoUrl: null }),
    create: vi.fn().mockResolvedValue({ id: sourceId }),
    update: vi.fn().mockResolvedValue({ id: sourceId }),
  };
  const media = { isManagedLogoUrl: vi.fn().mockReturnValue(false), deleteLocalImage: vi.fn() };
  const service = new SourcesService(
    { prisma: { country, source } } as unknown as DatabaseService,
    media as unknown as SourceMediaService,
  );
  return { service, source, country };
}

describe("SCRUM-29 — création et mise à jour des métadonnées Source", () => {
  it("persiste tous les nouveaux champs sur création", async () => {
    const { service, source } = setup();
    const links = {
      rssPageUrl: "https://journal.example.org/rss",
      facebookUrl: "https://facebook.com/journal",
      xUrl: "https://x.com/journal",
      instagramUrl: "https://instagram.com/journal",
      youtubeUrl: "https://youtube.com/@journal",
      description: "Un média régional\nDepuis 1999",
    };
    await service.create({ ...input, ...links });
    expect(source.create.mock.calls[0]?.[0].data).toMatchObject(links);
  });

  it("utilise NULL lors d'une création depuis l'ancien formulaire", async () => {
    const { service, source } = setup();
    await service.create(input);
    expect(source.create.mock.calls[0]?.[0].data).toMatchObject({
      rssPageUrl: null, facebookUrl: null, xUrl: null,
      instagramUrl: null, youtubeUrl: null, description: null,
    });
  });

  it("met à jour les champs transmis sans effacer les autres si omis", async () => {
    const { service, source } = setup();
    await service.update(sourceId, { ...input, facebookUrl: null, description: "Nouvelle description" });
    const update = source.update.mock.calls[0]?.[0].data;
    expect(update.facebookUrl).toBeNull();
    expect(update.description).toBe("Nouvelle description");
    expect(update).not.toHaveProperty("rssPageUrl");
    expect(update).not.toHaveProperty("youtubeUrl");
  });

  it("restitue les six champs avec GET /admin/sources/:id", async () => {
    const { service, source } = setup();
    const original = {
      id: sourceId,
      name: "Journal",
      slug: "journal",
      websiteUrl: "https://journal.example.org",
      logoUrl: null,
      country: { isoCode2: "FR" },
      isActive: true,
      rssPageUrl: "https://journal.example.org/rss",
      facebookUrl: null,
      xUrl: "https://x.com/journal",
      instagramUrl: null,
      youtubeUrl: null,
      description: "Information locale",
    };
    source.findUnique.mockResolvedValue(original);
    const result = await service.getById(sourceId);
    expect(result).toMatchObject({
      id: original.id,
      name: original.name,
      rssPageUrl: original.rssPageUrl,
      facebookUrl: original.facebookUrl,
      xUrl: original.xUrl,
      instagramUrl: original.instagramUrl,
      youtubeUrl: original.youtubeUrl,
      description: original.description,
      countryIsoCode2: "FR",
    });
    expect(source.findUnique.mock.calls[0]?.[0].select).toMatchObject({
      rssPageUrl: true, facebookUrl: true, xUrl: true,
      instagramUrl: true, youtubeUrl: true, description: true,
    });
  });
});
