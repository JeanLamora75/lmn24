import { describe, expect, it } from "vitest";

import { mergeSocialDiscovery } from "./source-social-discovery";

describe("SCRUM-30 — préremplissage non destructif", () => {
  it("complète uniquement les champs vides", () => {
    const result = mergeSocialDiscovery(
      { facebookUrl: "", xUrl: "https://x.com/existant", instagramUrl: null, youtubeUrl: "" },
      { facebookUrl: "https://facebook.com/journal", xUrl: "https://x.com/existant", instagramUrl: "https://instagram.com/journal", youtubeUrl: null },
    );
    expect(result.next).toEqual({
      facebookUrl: "https://facebook.com/journal", xUrl: "https://x.com/existant",
      instagramUrl: "https://instagram.com/journal", youtubeUrl: "",
    });
    expect(result.added).toBe(2);
    expect(result.found).toBe(3);
    expect(result.conflicts).toEqual({});
  });

  it("propose les valeurs différentes sans écraser les saisies de l'administrateur", () => {
    const result = mergeSocialDiscovery(
      { facebookUrl: "https://facebook.com/ancien", xUrl: null, instagramUrl: "https://instagram.com/existant", youtubeUrl: null },
      { facebookUrl: "https://facebook.com/nouveau", xUrl: null, instagramUrl: "https://instagram.com/autre", youtubeUrl: null },
    );
    expect(result.next.facebookUrl).toBe("https://facebook.com/ancien");
    expect(result.next.instagramUrl).toBe("https://instagram.com/existant");
    expect(result.conflicts).toEqual({
      facebookUrl: "https://facebook.com/nouveau",
      instagramUrl: "https://instagram.com/autre",
    });
    expect(result.added).toBe(0);
  });

  it("ne modifie rien si le site ne présente aucun compte", () => {
    const original = { facebookUrl: "", xUrl: null, instagramUrl: null, youtubeUrl: null };
    const outcome = mergeSocialDiscovery(original, {
      facebookUrl: null, xUrl: null, instagramUrl: null, youtubeUrl: null,
    });
    expect(outcome.next).toEqual(original);
    expect(outcome.found).toBe(0);
  });
});
