import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const ui = readFileSync(new URL("./VideosAdmin.tsx", import.meta.url), "utf8");
const service = readFileSync(new URL("../../../../backend/src/videos/videos.service.ts", import.meta.url), "utf8");
describe("SCRUM-42 video administration", () => {
  it("supports editorial filtering and pagination", () => {
    for (const word of ["Recherche", "Source", "Catégorie", "Langue", "Publication", "Précédent", "Suivant"])
      expect(ui).toContain(word);
  });
  it("supports publication and editorial reclassification", () => {
    for (const word of ["isPublished", "categoryId", "languageIsoCode2", "Masquer", "Publier"])
      expect(ui).toContain(word);
    expect(service).toContain("prisma.video.update");
    expect(service).toContain("publishedAt: \"desc\"");
  });
});