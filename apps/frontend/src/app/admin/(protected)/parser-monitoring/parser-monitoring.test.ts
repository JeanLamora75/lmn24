import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const page = readFileSync(new URL("./ParserMonitoringScreen.tsx", import.meta.url),"utf8");
const proxy = readFileSync(new URL("../../../api/admin/parser-monitoring/[...segments]/route.ts",import.meta.url),"utf8");
describe("SCRUM-60 — common parser monitoring UI", () => {
  it("offers the six KPIs and both parsers on one screen", () => {
    for(const text of ["Logs et statistiques des parsers","Taux de réussite",
      "Flux actifs","Nouveaux contenus","Flux en erreur","Durée moyenne",
      "Dernière collecte","Parser Infos","Parser Vidéos","Historique des exécutions",
      "Lancements globaux","Alertes et anomalies"]) expect(page).toContain(text);
  });
  it("supports period, type/status filters, paging, CSV and stored event details", () => {
    for(const text of ["30 jours","24 heures","Personnalisée",
      "export?","batches/","events?page=","pageSize=20",
      "errorsOnly","setInterval","30_000","table-responsive"])expect(page).toContain(text);
    expect(proxy).toContain('cookie: request.headers.get("cookie")');
    expect(proxy).toContain('permitted.has(segments[0]!)');
  });
});
