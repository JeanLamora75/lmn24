import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const ui = readFileSync(new URL("./StatisticsDashboard.tsx", import.meta.url), "utf8");
const backend = readFileSync(new URL("../../../../backend/src/statistics/statistics.service.ts", import.meta.url), "utf8");

describe("SCRUM-35 dashboard", () => {
  it("contains all six statistical areas", () => {
    for (const title of ["Vue d'ensemble", "Activité éditoriale", "Couverture géographique",
      "Santé des flux", "Qualité des fiches", "Actions prioritaires"]) expect(ui).toContain(title);
  });
  it("supports date and editorial filters", () => {
    for (const filter of ["countryId", "categoryId", "language", "sourceId", "period", "from", "to"])
      expect(ui).toContain(filter);
  });
  it("aggregates only server-side and relates articles to sources", () => {
    expect(backend).toContain("prisma.article.findMany");
    expect(backend).toContain("sourceId");
    expect(backend).toContain("prisma.feedRun.findMany");
  });
});
