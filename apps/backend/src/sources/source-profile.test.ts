import { describe, expect, it } from "vitest";

import {
  isValidSourceProfileUrl,
  sourceProfileSchema,
} from "@lmn24/contracts";

describe("SCRUM-29 — validation partagée des liens de sources", () => {
  it("accepte les cinq champs facultatifs vides pour les anciennes requêtes", () => {
    expect(sourceProfileSchema.parse({})).toEqual({});
    expect(sourceProfileSchema.parse({
      rssPageUrl: "", facebookUrl: " ", xUrl: null,
      instagramUrl: "", youtubeUrl: "", description: "",
    })).toEqual({
      rssPageUrl: null, facebookUrl: null, xUrl: null,
      instagramUrl: null, youtubeUrl: null, description: null,
    });
  });

  it("valide des URLs de profils de chaque plateforme", () => {
    const input = {
      rssPageUrl: " https://journal.example.org/rss ",
      facebookUrl: "https://www.facebook.com/journal",
      xUrl: "https://twitter.com/journal",
      instagramUrl: "https://instagram.com/journal/",
      youtubeUrl: "https://www.youtube.com/@journal",
      description: "  Première ligne\nDeuxième ligne  ",
    };
    expect(sourceProfileSchema.parse(input)).toEqual({
      ...input,
      rssPageUrl: "https://journal.example.org/rss",
      description: "Première ligne\nDeuxième ligne",
    });
    expect(isValidSourceProfileUrl("https://x.com/journal", "xUrl")).toBe(true);
  });

  it("bloque les URL dangereuses, les hôtes usurpés et les URLs relatives", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,test",
      "/flux/rss.xml",
      "https://facebook.com.attacker.example/profile",
      "https://evilfacebook.com/page",
      "https://alice:secret@facebook.com/path",
      "https://youtube.com.evil.test/channel",
      "https://x.com@evil.test/profile",
    ]) {
      expect(isValidSourceProfileUrl(url, "facebookUrl")).toBe(false);
    }
    expect(sourceProfileSchema.safeParse({
      xUrl: "https://facebook.com/journal",
    }).success).toBe(false);
    expect(sourceProfileSchema.safeParse({
      instagramUrl: "https://instagram.com.evil.test/journal",
    }).success).toBe(false);
    expect(sourceProfileSchema.safeParse({
      youtubeUrl: "https://youtu.be/video",
    }).success).toBe(false);
  });

  it("autorise 5000 caractères et rejette 5001 caractères dans la description", () => {
    expect(sourceProfileSchema.safeParse({ description: "é".repeat(5000) }).success).toBe(true);
    expect(sourceProfileSchema.safeParse({ description: "é".repeat(5001) }).success).toBe(false);
  });

  it("refuse une URL dépassant 2048 caractères", () => {
    expect(sourceProfileSchema.safeParse({
      rssPageUrl: "https://example.org/" + "a".repeat(2100),
    }).success).toBe(false);
  });
});
