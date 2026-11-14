import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tracker = readFileSync(new URL("./GoogleAnalyticsTracker.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../../app/[locale]/layout.tsx", import.meta.url), "utf8");
const adminLayout = readFileSync(new URL("../../app/admin/layout.tsx", import.meta.url), "utf8");
const footer = readFileSync(new URL("./PublicFooter.tsx", import.meta.url), "utf8");

describe("LMN24 public Google Analytics consent and navigation tracking", () => {
  it("uses the correct GA4 property measurement ID", () => {
    expect(tracker).toContain('GA4_MEASUREMENT_ID = "G-Z54C7T331W"');
  });
  it("never loads the Google tag before acceptance", () => {
    expect(tracker).toContain('consent !== "accepted"');
    expect(tracker).toContain('document.createElement("script")');
    expect(tracker).toContain('script.src = "https://www.googletagmanager.com/gtag/js?id="');
    expect(tracker).toContain("window.localStorage.setItem");
  });
  it("tracks page views on pathname and search changes without automatic duplicates", () => {
    expect(tracker).toContain("usePathname()");
    expect(tracker).toContain("useSearchParams()");
    expect(tracker).toContain("send_page_view: false");
    expect(tracker).toContain('window.gtag?.("event", "page_view"');
    expect(tracker).toContain("lastTracked.current === path");
  });
  it("mounts only in public multilingual layout and offers eight-language consent controls", () => {
    expect(layout).toContain("<GoogleAnalyticsTracker />");
    expect(adminLayout).not.toContain("GoogleAnalyticsTracker");
    for (const locale of ["fr", "en", "de", "es", "pt", "it", "ru", "nl"])
      expect(tracker).toMatch(new RegExp("^\\s*" + locale + ": \\{", "m"));
    expect(footer).toContain("OPEN_ANALYTICS_SETTINGS_EVENT");
    expect(tracker).toContain('value === "refused"');
    expect(tracker).toContain("clearAnalyticsCookies()");
  });
});
