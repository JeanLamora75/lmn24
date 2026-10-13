import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(new URL("../page.tsx", import.meta.url), "utf8");
const common = readFileSync(new URL("./ParserRunScreen.tsx", import.meta.url), "utf8");
const videoPage = readFileSync(new URL("../video-parser/page.tsx", import.meta.url), "utf8");
const backend = readFileSync(new URL("../../../api/admin/parser/video-runs/route.ts", import.meta.url), "utf8");

describe("SCRUM-46 video parser administration", () => {
  it("has two distinct parser actions, sharing the existing news parser page", () => {
    expect(dashboard).toContain('title: "Lancer le Parser Infos"');
    expect(dashboard).toContain('title: "Lancer le Parser Vidéos"');
    expect(videoPage).toContain('<ParserRunScreen mode="videos" />');
    expect(dashboard).toContain('href: "/admin/parser"');
    expect(dashboard).toContain('href: "/admin/video-parser"');
  });
  it("offers optional country/language/category filters and a live progress log", () => {
    expect(common).toContain('id="parser-country"');
    expect(common).toContain('id="parser-language"');
    expect(common).toContain('id="parser-category"');
    expect(common).toContain('endpoint + "/"');
    expect(common).toContain('new EventSource(');
    expect(common).toContain('aria-live="polite"');
    expect(common).toContain('"/api/admin/video-feeds/form-options"');
    expect(backend).toContain('/admin/parser/video-runs');
  });
});
