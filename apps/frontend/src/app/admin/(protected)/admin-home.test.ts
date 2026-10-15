import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  ADMIN_SECTIONS,
  filterAdminSections,
  normalizeAdminSearch,
} from "./admin-home.data";

const page = readFileSync(new URL("./AdminHomeClient.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./admin-home.module.css", import.meta.url), "utf8");
const oldRoutes = [
  "/admin/sources", "/admin/feeds", "/admin/video-feeds",
  "/admin/videos", "/admin/categories", "/admin/hashtags",
  "/admin/parser", "/admin/video-parser", "/admin/parser-monitoring",
  "/admin/site-statistics", "/admin/hashtag-trends", "/admin/languages",
  "/admin/settings", "/admin/import-csv", "/admin/retention",
  "/admin/data-purge",
];

describe("SCRUM-13 — administration home registry and grouping", () => {
  it("contains the five approved sections in the correct order (3/4/3/4/3)", () => {
    expect(ADMIN_SECTIONS.map((section) => section.title)).toEqual([
      "Sources et flux", "Contenus et référentiels",
      "Collecte et supervision", "Analyse et configuration",
      "Données et maintenance",
    ]);
    expect(ADMIN_SECTIONS.map((section) => section.features.length)).toEqual([3, 4, 3, 4, 3]);
  });

  it("includes each of the 16 original paths exactly once", () => {
    const links = ADMIN_SECTIONS.flatMap(section => section.features.map(feature => feature.href));
    expect(links).toHaveLength(17);
    expect(new Set(links).size).toBe(17);
    expect([...links].sort()).toEqual([...oldRoutes, "/admin/horoscopes"].sort());
  });

  it("keeps the parser monitoring title and direct links intact", () => {
    const monitoring = ADMIN_SECTIONS.flatMap(section => section.features)
      .find(feature => feature.href === "/admin/parser-monitoring");
    expect(monitoring?.title).toBe("Logs et statistiques des parsers");
    expect(ADMIN_SECTIONS.flatMap(section => section.features)
      .find(feature => feature.href === "/admin/video-parser")?.title)
      .toBe("Lancer le Parser Vidéos");
  });

  it("uses only locally available Bootstrap Icons, including section icons", () => {
    const allIcons = [...ADMIN_SECTIONS.flatMap(section => [
      section.icon, ...section.features.map(feature => feature.icon),
    ])];
    for (const icon of allIcons) {
      expect(existsSync(new URL(`../../../../public/bootstrap-icons/${icon}.svg`, import.meta.url)))
        .toBe(true);
    }
  });
});

describe("SCRUM-13 — instant local search", () => {
  it("normalizes case, accents and surrounding whitespace", () => {
    expect(normalizeAdminSearch("  VIDÉOS  ")).toBe("videos");
    expect(normalizeAdminSearch("StatistIQUES")).toBe("statistiques");
    expect(normalizeAdminSearch("Purgé")).toBe("purge");
  });

  it("returns all five groups and 17 cards for a blank search", () => {
    expect(filterAdminSections(ADMIN_SECTIONS, " ").map(section => section.features.length))
      .toEqual([3, 4, 3, 4, 3]);
  });

  it("finds Video cards across different groups without accents", () => {
    const results = filterAdminSections(ADMIN_SECTIONS, "VIDEO");
    expect(results.flatMap(section => section.features.map(item => item.href)))
      .toContain("/admin/videos");
    expect(results.flatMap(section => section.features.map(item => item.href)))
      .toContain("/admin/video-feeds");
    expect(results.flatMap(section => section.features.map(item => item.href)))
      .toContain("/admin/video-parser");
    expect(results.every(section => section.features.length > 0)).toBe(true);
  });

  it("finds statistics in titles/descriptions and shows no empty groups", () => {
    const results = filterAdminSections(ADMIN_SECTIONS, "statistiques");
    const links = results.flatMap(section => section.features.map(item => item.href));
    expect(links).toContain("/admin/site-statistics");
    expect(links).toContain("/admin/parser-monitoring");
    expect(results.every(section => section.features.length > 0)).toBe(true);
  });

  it("searches section names and shows that entire section", () => {
    const results = filterAdminSections(ADMIN_SECTIONS, "MAINTENANCE");
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("Données et maintenance");
    expect(results[0]?.features).toHaveLength(3);
  });

  it("handles zero results without modifying original content", () => {
    const noMatches = filterAdminSections(ADMIN_SECTIONS, "zz-unknown-admin-menu");
    expect(noMatches).toEqual([]);
    expect(ADMIN_SECTIONS.map(section => section.features.length)).toEqual([3, 4, 3, 4, 3]);
  });
});

describe("SCRUM-13 — accessible responsive layout contracts", () => {
  it("retains semantic headings, whole-card links and visible search labels", () => {
    expect(page).toContain('htmlFor="admin-feature-search"');
    expect(page).toContain('aria-live="polite"');
    expect(page).toContain('role="status"');
    expect(page).toContain('href={feature.href}');
    expect(page).toContain("aria-label={feature.title}");
    expect(page).toContain('<h3 className={styles.cardTitle}>');
  });
  it("keeps all sections open by default, collapsible, and forced open while searching", () => {
    expect(page).toContain('const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})');
    expect(page).toContain('const expanded = hasQuery || collapsed[section.id] !== true');
    expect(page).toContain('aria-expanded={expanded}');
    expect(page).toContain('aria-controls={panelId}');
    expect(page).toContain('hidden={!expanded}');
    expect(page).toContain('disabled={hasQuery}');
  });
  it("renders icons to the LEFT of title within cards, in Bootstrap 3/2/1 columns", () => {
    expect(page).toContain('className="col-12 col-md-6 col-lg-4"');
    expect(page.indexOf('className={styles.iconWrapper}')).toBeLessThan(
      page.indexOf('className={styles.cardContent}'),
    );
    expect(styles).toContain(".cardBody {");
    expect(styles).toContain("display: flex");
    expect(styles).toContain(".cardDescription {");
    expect(styles).toContain("-webkit-line-clamp: 2");
    expect(styles).toContain("focus-visible");
    expect(styles).toContain("prefers-reduced-motion: reduce");
  });
});
