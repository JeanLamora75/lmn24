import { describe, expect, it } from "vitest";

import { newFeedForSourceHref, sourceArticlesHref, sourceFeedsHref } from "./source-admin-links";

describe("SCRUM-14 — liens depuis les compteurs", () => {
  it("applique l'identifiant exact et affiche le nom, avec encodage des caractères spéciaux", () => {
    const href = sourceFeedsHref("11111111-1111-4111-8111-111111111111", "Le Monde & vous");
    const url = new URL(href, "http://localhost:3000");
    expect(url.pathname).toBe("/admin/feeds");
    expect(url.searchParams.get("sourceId")).toBe("11111111-1111-4111-8111-111111111111");
    expect(url.searchParams.get("sourceName")).toBe("Le Monde & vous");
  });

  it("ouvre la fiche publique de la source depuis le compteur d'articles", () => {
    expect(sourceArticlesHref("le-monde")).toBe("/fr/source/le-monde");
    expect(sourceArticlesHref("le-monde", "nl")).toBe("/nl/source/le-monde");
  });
  it("ouvre le formulaire de création et transmet exactement l'identifiant source", () => {
    const sourceId = "11111111-1111-4111-8111-111111111111";
    const href = newFeedForSourceHref(sourceId);
    const url = new URL(href, "http://localhost:3000");
    expect(url.pathname).toBe("/admin/feeds/new");
    expect(url.searchParams.get("sourceId")).toBe(sourceId);
    expect(url.searchParams.has("sourceName")).toBe(false);
  });

});
