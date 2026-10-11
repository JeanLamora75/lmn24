import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const form = readFileSync(new URL("./SourceForm.tsx", import.meta.url), "utf8");

describe("SCRUM-29 — formulaire enrichi des sources", () => {
  it("contient la section et les champs des cinq liens et de description", () => {
    expect(form).toContain("Présentation et réseaux sociaux");
    for (const field of [
      "rssPageUrl", "facebookUrl", "xUrl",
      "instagramUrl", "youtubeUrl",
    ]) {
      expect(form).toContain('key: "' + field + '"');
    }
    expect(form).toContain('<textarea');
    expect(form).toContain('id="source-description"');
    expect(form).toContain("5 000 caractères");
  });

  it("préremplit, contrôle et enregistre les six valeurs", () => {
    for (const field of [
      "rssPageUrl", "facebookUrl", "xUrl", "instagramUrl",
      "youtubeUrl", "description",
    ]) {
      expect(form).toContain("source." + field + ' ?? ""');
      expect(form).toContain(field + ": values." + field);
    }
    expect(form).toContain("sourceProfileSchema.safeParse");
    expect(form).toContain("aria-invalid={Boolean(fieldErrors[key])}");
    expect(form).toContain('id={"error-" + key}');
    expect(form).toContain('id="source-description-error"');
  });

  it("sépare la page RSS des flux du parser sans modifier l'action Capturer", () => {
    expect(form).toContain("Le lien vers la page RSS ne crée pas de flux RSS/XML.");
    expect(form).toContain('onClick={() => void capture()}');
    expect(form).toContain('"/api/admin/sources/capture"');
  });
});
