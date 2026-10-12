import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const list = readFileSync(new URL("./CategoryArticles.tsx", import.meta.url), "utf8");
const category = readFileSync(new URL("../../app/[locale]/category/[slug]/page.tsx", import.meta.url), "utf8");
const source = readFileSync(new URL("../../app/[locale]/source/[slug]/page.tsx", import.meta.url), "utf8");

describe("SCRUM-34 — chargement automatique catégories et sources", () => {
  it("réutilise le même composant pour les deux pages", () => {
    expect(category).toContain("<CategoryArticles");
    expect(source).toContain("<CategoryArticles");
  });

  it("déclenche les lots suivants au bas de la liste avec une marge de 300px", () => {
    expect(list).toContain("new IntersectionObserver(");
    expect(list).toContain('rootMargin: "0px 0px 300px 0px"');
    expect(list).toContain("entry.isIntersecting");
    expect(list).toContain("sentinelRef");
    expect(list).toContain("CATEGORY_NEXT_PAGE_SIZE");
  });

  it("protège les requêtes simultanées et conserve le dédoublonnage", () => {
    expect(list).toContain("busy.current || !hasMore || !cursor");
    expect(list).toContain("appendUniqueArticles(current, data.items)");
  });

  it("permet de réessayer uniquement en cas d'erreur et conserve un repli sans API observer", () => {
    expect(list).toContain("!hasMore || !cursor || error || loading");
    expect(list).toContain("error || !supportsObserver");
    expect(list).toContain("error ? labels.retry : labels.loadMore");
  });
});
