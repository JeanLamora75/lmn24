import { describe, expect, it } from "vitest";
import { isTvPublicApiPath, isTvPublicPagePath, shouldBlockPublicTv, tvPublicEnabled } from "./tv-public-gate";

const locales = ["fr", "en", "de", "es", "pt", "it", "ru", "nl"];
describe("SCRUM-113 Next.js Guide TV public embargo", () => {
  it("fails closed, including single-key configurations", () => {
    expect(tvPublicEnabled({})).toBe(false);
    expect(tvPublicEnabled({ TV_PUBLIC_ENABLED: "true" })).toBe(false);
    expect(tvPublicEnabled({ TV_PUBLIC_RELEASE_APPROVED: "true" })).toBe(false);
    expect(tvPublicEnabled({ TV_PUBLIC_ENABLED: "TRUE", TV_PUBLIC_RELEASE_APPROVED: "true" })).toBe(false);
    expect(tvPublicEnabled({ TV_PUBLIC_ENABLED: "true", TV_PUBLIC_RELEASE_APPROVED: "true" })).toBe(true);
  });
  it("blocks all supported localized TV pages and search", () => {
    for (const locale of locales) for (const path of [
      `/${locale}/tv`, `/${locale}/tv/search?q=2`, `/${locale}/tv/channels/demo`,
      `/${locale}/programme-tv`, `/${locale}/programme-tv/programmes/123`,
    ]) {
      expect(isTvPublicPagePath(path), path).toBe(true);
      expect(shouldBlockPublicTv(path, {}), path).toBe(true);
    }
    expect(shouldBlockPublicTv("/tv", {})).toBe(true);
    expect(shouldBlockPublicTv("/programme-tv", {})).toBe(true);
    expect(shouldBlockPublicTv("/api/public/tv/search", {})).toBe(true);
    expect(shouldBlockPublicTv("/api/tv/public/countries", {})).toBe(true);
  });
  it("keeps unrelated and admin paths unchanged", () => {
    for (const path of ["/fr", "/fr/videos", "/fr/tv-archive", "/admin/tv", "/api/admin/tv/channels", "/api/public/weather", "/fr/category/tv"]) {
      expect(shouldBlockPublicTv(path, {}), path).toBe(false);
    }
  });
  it("requires explicit dual release config", () => {
    expect(shouldBlockPublicTv("/fr/tv", { TV_PUBLIC_ENABLED: "true", TV_PUBLIC_RELEASE_APPROVED: "true" })).toBe(false);
  });
});
