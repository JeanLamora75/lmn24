import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { BOOTSTRAP_DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@lmn24/config";

import de from "../../../../messages/de.json";
import en from "../../../../messages/en.json";
import es from "../../../../messages/es.json";
import fr from "../../../../messages/fr.json";
import italianMessages from "../../../../messages/it.json";
import nl from "../../../../messages/nl.json";
import pt from "../../../../messages/pt.json";
import ru from "../../../../messages/ru.json";

describe("SCRUM-28 — néerlandais (nl) dans LMN24", () => {
  it("publie exactement huit langues tout en conservant le français par défaut", () => {
    expect(SUPPORTED_LOCALES).toEqual(["fr", "en", "de", "es", "pt", "it", "ru", "nl"]);
    expect(BOOTSTRAP_DEFAULT_LOCALE).toBe("fr");
  });

  it("traduit toutes les clés publiques de nl avec les mêmes rubriques et pays", () => {
    for (const section of ["countries", "categories", "home", "categoryPage"] as const) {
      expect(Object.keys(nl[section])).toEqual(Object.keys(fr[section]));
      expect(Object.values(nl[section]).every(value => typeof value === "string" && value.trim().length > 0)).toBe(true);
    }
    expect(Object.keys(nl.languages)).toEqual([...Object.keys(fr.languages).filter(x => x !== "nl"), "nl"]);
    expect(nl.languages.nl).toBe("Nederlands");
    expect(nl.countries.NL).toBe("Nederland");
    expect(nl.categories.sports).toBe("Sport");
    expect(nl.home.category).toContain("{name}");
  });

  it("rend le néerlandais identifiable dans les huit sélecteurs linguistiques", () => {
    const labels = [fr, en, de, es, pt, italianMessages, ru, nl].map(messages => messages.languages.nl);
    expect(labels).toEqual([
      "Néerlandais", "Dutch", "Niederländisch", "Neerlandés",
      "Neerlandês", "Olandese", "Нидерландский", "Nederlands",
    ]);
    expect(existsSync(new URL("../../public/flags/nl.png", import.meta.url))).toBe(true);
  });
});
