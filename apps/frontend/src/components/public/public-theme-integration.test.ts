import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = readFileSync(new URL("../../app/[locale]/layout.tsx", import.meta.url), "utf8");
const globalStyles = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
const headerStyles = readFileSync(new URL("./PublicHeader.module.css", import.meta.url), "utf8");
const homeStyles = readFileSync(new URL("../home/home.module.css", import.meta.url), "utf8");
const weatherStyles = readFileSync(new URL("../weather/weather.module.css", import.meta.url), "utf8");
const controller = readFileSync(new URL("./PublicThemeController.tsx", import.meta.url), "utf8");

describe("SCRUM-106 — theme integration regression", () => {
  it("pre-paints the saved public theme while avoiding hydration errors", () => {
    expect(root).toContain("<html lang={locale} suppressHydrationWarning>");
    expect(root).toContain("VISITOR_THEME_BOOTSTRAP_SCRIPT");
    expect(root.indexOf("<script dangerouslySetInnerHTML")).toBeLessThan(root.indexOf("<body"));
    expect(root).toContain("<PublicThemeController />");
  });
  it("leaves the original public light appearance without a saved preference", () => {
    expect(globalStyles).toContain("background: var(--bs-body-bg, #fff)");
    expect(globalStyles).toContain("color: var(--bs-body-color, #212529)");
    expect(controller).toContain("if (!ready) return;");
  });
  it("handles system color-scheme changes and Bootstrap CSS variables", () => {
    expect(controller).toContain('matchMedia("(prefers-color-scheme: dark)")');
    expect(controller).toContain('media.addEventListener("change", update)');
    expect(controller).toContain('media.removeEventListener("change", update)');
    expect(globalStyles).toContain('html[data-bs-theme="dark"]');
    expect(headerStyles).toContain(':global(html[data-bs-theme="dark"]) .headerLayout');
    expect(headerStyles).toContain(':global(html[data-bs-theme="dark"]) .navigationLink');
    expect(weatherStyles).toContain(':global(html[data-bs-theme="dark"]) .weatherCard');
    expect(homeStyles).toContain(':global(html[data-bs-theme="dark"]) .articleCard');
  });
});
