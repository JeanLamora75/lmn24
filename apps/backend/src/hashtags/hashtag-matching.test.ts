import { compileHashtags, matchArticleHashtags } from "@lmn24/contracts";
import { describe, expect, it } from "vitest";

const definitions = [
  { id: "moscow", name: "Moscou", aliases: [{ name: "Moscow" }, { name: "Москва" }] },
  { id: "new-zealand", name: "Nouvelle-Zélande", aliases: [{ name: "New Zealand" }] },
  { id: "rome", name: "Rome", aliases: [] },
];
const index = compileHashtags(definitions);

describe("SCRUM-51 — multilingual lexical hashtag matching", () => {
  it("counts a hashtag at most once even with multiple aliases and occurrences", () => {
    expect(matchArticleHashtags({ title: "Moscou parle de Moscou", summary: "Moscow and Москва" }, index))
      .toEqual(["moscow"]);
  });
  it("supports Unicode, accents, case and transliterated aliases only when provided", () => {
    expect(matchArticleHashtags({ title: "Москва сегодня", summary: null }, index)).toContain("moscow");
    expect(matchArticleHashtags({ title: "NOUVELLE-ZELANDE", summary: null }, index))
      .toContain("new-zealand");
    expect(matchArticleHashtags({ title: "Visiter New-Zealand", summary: null }, index))
      .toContain("new-zealand");
  });
  it("rejects substring matches and matches independent fields", () => {
    expect(matchArticleHashtags({ title: "Une promenade", summary: "Parcours" }, index))
      .not.toContain("rome");
    expect(matchArticleHashtags({ title: "Une promenade", summary: "Rome est là" }, index))
      .toContain("rome");
    expect(matchArticleHashtags({ title: "Nouvelle", summary: "Zélande" }, index))
      .not.toContain("new-zealand");
  });
  it("does not invent absent aliases or fuzzy matches", () => {
    expect(matchArticleHashtags({ title: "Moskwa", summary: "" }, index)).toEqual([]);
  });
  it("accepts punctuation between words but not inside other Unicode words", () => {
    expect(matchArticleHashtags({ title: "Москва—Rome", summary: "" }, index))
      .toEqual(["moscow", "rome"]);
    expect(matchArticleHashtags({ title: "Romeo", summary: "" }, index)).not.toContain("rome");
  });
});
