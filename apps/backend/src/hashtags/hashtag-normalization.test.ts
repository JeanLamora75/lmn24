import { normalizeHashtagTerm } from "@lmn24/contracts";
import { describe, expect, it } from "vitest";

describe("SCRUM-49 — canonical hashtag terms", () => {
  it("normalizes case, diacritics and whitespace", () => {
    expect(normalizeHashtagTerm("  NOUVELLE  ZÉLANDE ")).toBe("nouvelle zelande");
    expect(normalizeHashtagTerm("Moscou")).toBe("moscou");
  });
  it("does not transliterate Cyrillic names", () => {
    expect(normalizeHashtagTerm("Москва")).toBe("москва");
  });
});
