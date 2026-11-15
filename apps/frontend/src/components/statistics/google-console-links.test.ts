import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboards = [
  {
    name: "Google Analytics",
    file: "./GoogleAnalyticsDashboard.tsx",
    url: "https://analytics.google.com/analytics/web/",
  },
  {
    name: "Google Search Console",
    file: "./SearchConsoleDashboard.tsx",
    url: "https://search.google.com/search-console",
  },
] as const;

describe("LMN24 Google reports direct links", () => {
  it.each(dashboards)("opens $name directly and safely in a separate tab", ({ file, url }) => {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    expect(source).toContain(`href="${url}" target="_blank" rel="noopener noreferrer"`);
    expect(source).toContain('aria-label="Ouvrir Google');
    expect(source).toContain("Consulter les statistiques dans Google");
  });
});
