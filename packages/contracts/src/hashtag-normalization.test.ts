import { describe, expect, it } from "vitest";
import { normalizeHashtagTerm } from "./hashtag-normalization";

describe("SCRUM-49 — canonical hashtag terms", () => {
  it("normalizes case, accents and whitespace", () => {
    expect(normalizeHashtagTerm("  NOUVELLE  ZÉLANDE ")).toBe("nouvelle zelande");
    expect(normalizeHashtagTerm("Moscou")).toBe("moscou");
  });
  it("does not transliterate Cyrillic aliases", () => {
    expect(normalizeHashtagTerm("Москва")).toBe("москва");
  });
});
