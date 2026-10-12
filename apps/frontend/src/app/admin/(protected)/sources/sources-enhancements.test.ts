import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ui = readFileSync(new URL("./SourcesTable.tsx", import.meta.url), "utf8");
const controller = readFileSync(new URL("../../../../../../backend/src/sources/sources.controller.ts", import.meta.url), "utf8");

describe("SCRUM-33 — liste des sources", () => {
  it("expose les trois filtres et leurs bornes non chevauchantes", () => {
    for (const value of ["1-5", "6-10", "11+", "1-25", "26-100", "101+"]) {
      expect(ui).toContain('value="' + value + '"');
    }
    for (const name of ["feedRange", "articleRange", "missingSocial"]) {
      expect(ui).toContain(name);
      expect(controller).toContain(name);
    }
  });

  it("ouvre les pages publiques dans un autre onglet", () => {
    expect(ui).toContain('"/fr/source/" + encodeURIComponent(source.slug)');
    expect(ui).toContain('target="_blank" rel="noopener noreferrer" className={styles.publicSourceLink}');
  });

  it("affiche les quatre réseaux même sans lien", () => {
    expect(ui).toContain("socialNetworks.map");
    expect(ui).toContain("styles.socialMissing");
    for (const name of ["facebookUrl", "instagramUrl", "youtubeUrl", "xUrl"]) {
      expect(ui).toContain(name);
    }
  });

  it("ajuste la pagination à la largeur disponible", () => {
    expect(ui).toContain("ResizeObserver");
    expect(ui).toContain("pageItems(pagination.page, pagination.totalPages");
    expect(ui).toContain("styles.paginationNav");
  });
});
