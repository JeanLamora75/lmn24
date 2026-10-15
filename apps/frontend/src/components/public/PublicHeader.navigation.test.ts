import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const header = readFileSync(new URL("./PublicHeader.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./PublicHeader.module.css", import.meta.url), "utf8");
const globe = new URL("../../../public/header-globe.webp", import.meta.url);

describe("SCRUM-10 — approved LMN24 header redesign", () => {
  it("keeps logo and language switcher, with real navigation between them", () => {
    const logoIndex = header.indexOf('src="/logo_lmn24.png"');
    const navIndex = header.indexOf('<nav className={styles.primaryNavigation}');
    const languageIndex = header.indexOf('<div className={styles.languagePanel}>');
    expect(logoIndex).toBeGreaterThan(-1);
    expect(navIndex).toBeGreaterThan(logoIndex);
    expect(languageIndex).toBeGreaterThan(navIndex);
    expect(header).toContain('href="/" className={styles.logoLink}');
    expect(header).toContain('className={styles.currentFlag}');
    expect(header).toContain('aria-haspopup="menu"');
    expect(header).toContain('aria-expanded={isOpen}');
    expect(header).toContain('aria-controls="public-language-menu"');
    expect(header).toContain('aria-checked={language === locale}');
    expect(header).toContain('router.replace(pathname, { locale: nextLocale })');
  });

  it("shows four real routes, with icon and visible text", () => {
    const start = header.indexOf("const VISIBLE_NAVIGATION = [");
    const end = header.indexOf("] as const satisfies", start);
    const registry = header.slice(start, end);
    for (const key of ['key: "news", href: "/"',
      'key: "videos", href: "/videos"', 'key: "hashtags", href: "/hashtags"', 'key: "horoscope", href: "/horoscope"']) {
      expect(registry).toContain(key);
    }
    expect((registry.match(/key: "/g) ?? [])).toHaveLength(4);
    expect(registry).not.toContain("podcasts");
    expect(registry).not.toContain("dossiers");
    expect(header).toContain('className={styles.navigationLabel}');
    expect(header).toContain('<NavigationIcon name={item.key} />');
    expect(header).toContain('aria-current={isActive ? "page" : undefined}');
    expect(header).not.toContain("L’ACTU QUI COMPTE");
    expect(header).not.toContain("L'actu qui compte");
  });

  it("has a seven-entry icon and translation registry for all eight existing locales", () => {
    const keys = ["news", "videos", "hashtags", "horoscope", "live", "podcasts", "dossiers"];
    for (const key of keys) {
      expect(header).toContain('case "' + key + '":');
    }
    for (const locale of ["fr", "en", "de", "es", "pt", "it", "ru", "nl"]) {
      expect(header).toMatch(new RegExp("\\b" + locale + ": \\{ news:"));
      const line = header.split("\n").find((row) => row.trimStart().startsWith(locale + ": {"));
      expect(line).toBeTruthy();
      for (const key of keys) expect(line).toContain(key + ":");
    }
    expect(header).toContain("SUPPORTED_LOCALES.map");
  });

  it("uses approved blue-white pill design and accessible responsive nav", () => {
    expect(header).toContain("sticky-top");
    expect(styles).toContain("var(--bs-primary)");
    expect(styles).toContain(".brandPanel::before");
    expect(styles).toContain(".brandPanel::after");
    expect(styles).toContain("border-radius: 999px");
    expect(styles).toContain(".navigationLink[aria-current=\"page\"]");
    expect(styles).toContain("overflow-x: auto");
    expect(styles).toContain("min-width: 0");
    expect(styles).toContain("scroll-snap-type: x proximity");
    expect(styles).toContain("@media (max-width: 1199.98px)");
    expect(styles).toContain("@media (max-width: 767.98px)");
    expect(styles).toContain('"navigation navigation"');
    expect(styles).toContain("focus-visible");
    expect(styles).toContain("prefers-reduced-motion: reduce");
  });

  it("contains local, non-interactive globe art and the flag chevron", () => {
    expect(styles).toContain('url("/header-globe.webp")');
    expect(header).toContain('aria-hidden="true"');
    expect(header).toContain('className={styles.globeVisual}');
    expect(header).toContain('className={styles.chevron}');
    expect(statSync(globe).size).toBeGreaterThan(1000);
    expect(statSync(globe).size).toBeLessThan(100_000);
    const magic = readFileSync(globe).subarray(0, 4).toString("ascii");
    expect(magic).toBe("RIFF");
  });
});
