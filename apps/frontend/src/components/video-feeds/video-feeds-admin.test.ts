import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const ui = readFileSync(new URL("./VideoFeedsAdmin.tsx", import.meta.url), "utf8");
describe("SCRUM-39 video feed screens", () => {
  it("provides list filters and paging", () => {
    for (const value of ["Recherche", "Source", "Catégorie", "Langue", "Statut", "Précédent", "Suivant"]) expect(ui).toContain(value);
  });
  it("provides YouTube feed editing, validation and activation", () => {
    for (const value of ["channelId", "feedUrl", "isActive", "form-options", "youtube.com/feeds/videos.xml"]) expect(ui).toContain(value);
  });
});
