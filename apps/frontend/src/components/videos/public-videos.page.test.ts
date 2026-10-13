import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("./PublicVideos.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../../app/[locale]/videos/page.tsx", import.meta.url), "utf8");
const header = readFileSync(new URL("../public/PublicHeader.tsx", import.meta.url), "utf8");

describe("SCRUM-43 public videos home screen", () => {
  it("removes all three public filters and the duplicate language badge", () => {
    expect(component).not.toContain('id="pv-category"');
    expect(component).not.toContain('id="pv-source"');
    expect(component).not.toContain('id="pv-country"');
    expect(component).not.toContain('new Intl.DisplayNames([locale],{type:"language"})');
    expect(component).not.toContain("initialFilters");
    expect(component).not.toContain('"/api/public/videos/filters');
    expect(component).toContain("className={styles.gallery}");
    expect(component).toContain("VideoPlayerModal");
  });

  it("fetches SSR videos without depending on the filters endpoint", () => {
    expect(page).toContain('"/public/videos?locale="+encodeURIComponent(locale)');
    expect(page).not.toContain("/public/videos/filters");
    expect(page).toContain("if(videosResponse.ok)");
    expect(page).toContain("initialPage={page}");
    expect(page).not.toContain("initialFilters");
  });

  it("requests only the current locale on subsequent pages", () => {
    expect(component).toContain('new URLSearchParams({locale,limit:"24"})');
    expect(component).not.toContain('q.set("categoryId"');
    expect(component).not.toContain('q.set("sourceId"');
    expect(component).not.toContain('q.set("country"');
    expect(component).toContain('if(nextCursor)q.set("cursor",nextCursor)');
    expect(header).toContain("router.replace(pathname, { locale: nextLocale })");
  });
});
