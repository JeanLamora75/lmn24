import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const file = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const shared = file("./ParserWorkspace.tsx");
const news = file("../../app/admin/(protected)/parser/ParserRunScreen.tsx");
const weather = file("../../app/admin/(protected)/weather-parser/WeatherParserScreen.tsx");
const monitoring = file("../../app/admin/(protected)/parser-monitoring/ParserMonitoringScreen.tsx");
const weatherMonitoring = file("../../app/admin/(protected)/parser-monitoring/WeatherMonitoringPanel.tsx");

describe("lot 3 — parcours unifié des parsers", () => {
  it("exposes all launch screens and monitoring from an accessible common navigation", () => {
    for (const href of ["/admin/parser", "/admin/video-parser", "/admin/weather-parser", "/admin/parser-monitoring"]) {
      expect(shared).toContain(href);
    }
    expect(shared).toContain('aria-current={active === item.href ? "page" : undefined}');
    for (const source of [news, weather, monitoring]) expect(source).toContain("<ParserWorkspaceHeader");
  });
  it("retains launch criteria and live status on infos/video and weather", () => {
    expect(news).toContain("<ParserCriteriaPanel");
    expect(news).toContain("<ParserSection");
    expect(news).toContain('new EventSource(');
    expect(news).toContain('setOutcome("success")');
    expect(news).toContain('setOutcome("error")');
    expect(weather).toContain("<ParserCriteriaPanel");
    expect(weather).toContain('weatherProgress(selectedRun)');
    expect(weather).toContain('<ParserSection id="weather-history-heading"');
  });
  it("uses readable selectors and shared history pagination", () => {
    expect(monitoring).toContain('id="monitor-country" className="form-select"');
    expect(monitoring).toContain('id="monitor-category" className="form-select"');
    expect(monitoring).not.toContain("Pays (UUID)");
    expect(monitoring).not.toContain("Catégorie (UUID)");
    expect(monitoring).toContain("parserStatusLabel");
    expect(monitoring).toContain("<AdminPagination");
    expect(weatherMonitoring).toContain("<AdminPagination");
  });
});
