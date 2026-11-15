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
    expect(ui).not.toContain("ResizeObserver");
    expect(ui).toContain("<AdminPagination");
    expect(ui).toContain('label="sources"');
    const shared = readFileSync(new URL("../../../../components/admin/AdminPagination.tsx", import.meta.url), "utf8");
    const styles = readFileSync(new URL("../../../../components/admin/admin-workspace.css", import.meta.url), "utf8");
    expect(shared).toContain('aria-label="Première page"');
    expect(shared).toContain('aria-label="Dernière page"');
    expect(shared).toContain('aria-current={item === current ? "page" : undefined}');
    expect(styles).toContain(".lmn-admin-pagination{width:100%;overflow-x:auto");
  });
});
