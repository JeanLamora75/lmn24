import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const header = readFileSync(new URL("./PublicHeader.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./PublicHeader.module.css", import.meta.url), "utf8");

describe("SCRUM-10 public header icon navigation", () => {
  it("places news and videos directly after the logo, before the language menu", () => {
    const logoIndex = header.indexOf('<Link href="/" className={styles.logoLink}');
    const navIndex = header.indexOf('<nav className={styles.primaryNavigation}');
    const newsIndex = header.indexOf('aria-label={navLabels.news}');
    const videosIndex = header.indexOf('aria-label={navLabels.videos}');
    const languageIndex = header.indexOf('className={`dropdown ${styles.languageDropdown}`}');
    expect(logoIndex).toBeGreaterThan(-1);
    expect(logoIndex).toBeLessThan(navIndex);
    expect(navIndex).toBeLessThan(newsIndex);
    expect(newsIndex).toBeLessThan(videosIndex);
    expect(videosIndex).toBeLessThan(languageIndex);
  });

  it("uses localized links with white bold inline SVG icons and accessible tooltips", () => {
    expect(header).toContain('href="/"');
    expect(header).toContain('href="/videos"');
    expect(header).toContain('aria-current={pathname === "/" ? "page" : undefined}');
    expect(header).toContain('aria-current={pathname === "/videos" ? "page" : undefined}');
    expect(header).toContain('strokeWidth="2.5"');
    expect(header).toContain('className={styles.navigationTooltip}');
    expect(header).toContain('navLabels.news');
    expect(header).toContain('navLabels.videos');
    for (const locale of ["fr", "en", "de", "es", "pt", "it", "ru", "nl"]) {
      expect(header).toMatch(new RegExp("\\b" + locale + ": \\{ news:"));
    }
  });

  it("uses Bootstrap theme primary, logo-height icons, hover and keyboard focus tooltips", () => {
    expect(header).not.toContain("sticky-top bg-white");
    expect(styles).toContain("background-color: var(--bs-primary)");
    expect(styles).toContain("height: 60px");
    expect(styles).toContain("height: 50px");
    expect(styles).toContain(".navigationLink:hover .navigationTooltip");
    expect(styles).toContain(".navigationLink:focus-visible .navigationTooltip");
    expect(styles).toContain("color: #fff");
  });
});
