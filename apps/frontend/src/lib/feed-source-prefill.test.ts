import { describe, expect, it } from "vitest";

import { resolveInitialFeedSourceId } from "./feed-source-prefill";

const sources = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Le Monde" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Le Monde régional" },
];

describe("SCRUM-21 — préremplissage sûr de la source du flux", () => {
  it("sélectionne uniquement l'identifiant exact de la source chargée", () => {
    expect(resolveInitialFeedSourceId(sources[0]!.id, sources)).toBe(sources[0]!.id);
    expect(resolveInitialFeedSourceId(sources[1]!.id, sources)).toBe(sources[1]!.id);
  });

  it("ne présélectionne rien si aucune source n'est demandée", () => {
    expect(resolveInitialFeedSourceId(undefined, sources)).toBe("");
    expect(resolveInitialFeedSourceId("", sources)).toBe("");
  });

  it("ne présélectionne pas une source absente des choix du backend", () => {
    expect(resolveInitialFeedSourceId("33333333-3333-4333-8333-333333333333", sources)).toBe("");
    expect(resolveInitialFeedSourceId("Le Monde", sources)).toBe("");
    expect(resolveInitialFeedSourceId(sources[0]!.id, [])).toBe("");
  });
});
