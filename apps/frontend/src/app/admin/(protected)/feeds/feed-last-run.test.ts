import { describe, expect, it } from "vitest";

import {
  lastRunDate,
  lastRunDuration,
  lastRunErrorMessage,
} from "./feed-last-run";

describe("SCRUM-20 — formatage des derniers runs", () => {
  it("affiche un tiret lorsque la date ou la durée est manquante", () => {
    expect(lastRunDate(null)).toBe("—");
    expect(lastRunDate("not-a-date")).toBe("—");
    expect(lastRunDuration(null)).toBe("—");
    expect(lastRunDuration(-2)).toBe("—");
  });

  it("formate les durées courtes en ms, les secondes et les minutes", () => {
    expect(lastRunDuration(0)).toBe("0 ms");
    expect(lastRunDuration(550)).toBe("550 ms");
    expect(lastRunDuration(1200)).toMatch(/^1[,.]2 s$/);
    expect(lastRunDuration(65_000)).toBe("1 min 5 s");
  });

  it("n'invente pas le message d'erreur absent et restitue le message du parser", () => {
    expect(lastRunErrorMessage(null)).toContain("Aucun détail");
    expect(lastRunErrorMessage({
      startedAt: "2026-10-10T13:00:00Z",
      durationMs: 100,
      itemsFound: 0,
      articlesImported: 0,
      status: "ERROR",
      errorMessage: "  Connexion refusée  ",
    })).toBe("Connexion refusée");
  });
});
