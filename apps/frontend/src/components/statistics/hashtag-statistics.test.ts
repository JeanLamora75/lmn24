import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(new URL("./StatisticsDashboard.tsx", import.meta.url), "utf8");
const section = readFileSync(new URL("./HashtagStatistics.tsx", import.meta.url), "utf8");
const proxy = readFileSync(new URL("../../app/api/admin/statistics/hashtags/route.ts", import.meta.url), "utf8");

describe("SCRUM-59 — isolated dashboard block", () => {
  it("mounts the new block between editorial activity and geographical coverage", () => {
    const block = dashboard.indexOf("<HashtagStatistics />");
    expect(block).toBeGreaterThan(dashboard.indexOf("Activité éditoriale"));
    expect(block).toBeLessThan(dashboard.indexOf("Couverture géographique et thématique"));
    for (const sectionName of ["Vue d’ensemble", "Santé des flux", "Actions prioritaires"]) {
      expect(dashboard).toContain(sectionName);
    }
  });
  it("keeps independent periods, global coverage disclosure and separate error boundary", () => {
    for (const label of ["24h", "7d", "30d", "période Hashtags indépendante",
      "Tous pays, toutes sources", "Réessayer", "Statistiques Hashtags"]) {
      expect(section).toContain(label);
    }
    expect(proxy).toContain('for (const key of ["period", "ids"])');
    expect(section).toContain("/api/admin/statistics/hashtags?");
  });
  it("displays all five requested blocks and an accessible chart with at most five topics", () => {
    for (const phrase of ["Hashtags enregistrés", "Hashtags actifs",
      "Alias enregistrés", "Sujets cités", "Sujets en tendance",
      "Top 10 — Hashtags les plus cités", "Top 10 — Tendances",
      "Évolution des mentions", "Qualité et couverture du référentiel",
      "Santé des statistiques Hashtags", "aria-label", "role=\"img\"",
      "disabled={selectedIds.length >= 5}"]) {
      expect(section).toContain(phrase);
    }
  });
  it("labels unreliable numbers N/A rather than fabricated zero", () => {
    expect(section).toContain('value === null ? "N/A"');
    expect(section).toContain("data.health.currentPeriodCovered");
    expect(section).toContain("comparison30dAvailable");
  });
});
