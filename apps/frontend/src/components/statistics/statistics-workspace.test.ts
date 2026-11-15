import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const shared = read("./StatisticsWorkspace.tsx");
const dashboard = read("./StatisticsDashboard.tsx");
const analytics = read("./GoogleAnalyticsDashboard.tsx");
const consoleDashboard = read("./SearchConsoleDashboard.tsx");
const trends = read("../../app/admin/(protected)/hashtag-trends/HashtagTrendSettings.tsx");
const retention = read("../../app/admin/(protected)/retention/RetentionSettings.tsx");
const scheduler = read("../../app/admin/(protected)/scheduler/SchedulerSettings.tsx");

describe("lot 4 — uniformisation des statistiques et paramètres", () => {
  it("propose trois sources de statistiques navigables et identifie l'onglet actif", () => {
    for (const route of ["/admin/site-statistics", "/admin/site-statistics/google-analytics", "/admin/site-statistics/search-console"])
      expect(shared).toContain(route);
    expect(shared).toContain('aria-current={active === item.href ? "page" : undefined}');
    for (const source of [dashboard, analytics, consoleDashboard])
      expect(source).toContain("<StatisticsWorkspaceHeader");
  });
  it("isole les filtres des résultats sans altérer les liens directs Google", () => {
    for (const source of [dashboard, analytics, consoleDashboard])
      expect(source).toContain("<StatisticsFilterPanel>");
    expect(analytics).toContain('href="https://analytics.google.com/analytics/web/" target="_blank" rel="noopener noreferrer"');
    expect(consoleDashboard).toContain('href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer"');
  });
  it("utilise les en-têtes normalisés de configuration", () => {
    for (const source of [trends, retention, scheduler])
      expect(source).toContain("<AdminPageHeading");
  });
});
