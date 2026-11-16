import { describe, expect, it, vi } from "vitest";
import { applyVisitorTheme, resolveVisitorTheme, VISITOR_THEME_BOOTSTRAP_SCRIPT } from "./visitor-theme";

describe("SCRUM-106 — public theme resolution", () => {
  it("preserves original light site without a saved theme", () => {
    expect(resolveVisitorTheme(null, true)).toBe("light");
    expect(resolveVisitorTheme(null, false)).toBe("light");
  });
  it("respects explicit choices regardless of OS preferences", () => {
    expect(resolveVisitorTheme("light", true)).toBe("light");
    expect(resolveVisitorTheme("dark", false)).toBe("dark");
  });
  it("system selection follows the operating-system scheme", () => {
    expect(resolveVisitorTheme("system", true)).toBe("dark");
    expect(resolveVisitorTheme("system", false)).toBe("light");
  });
  it("removes theme override for reset, instead of forcing system dark mode", () => {
    const element = { setAttribute: vi.fn(), removeAttribute: vi.fn() };
    expect(applyVisitorTheme(element, null, true)).toBe("light");
    expect(element.removeAttribute).toHaveBeenCalledWith("data-bs-theme");
    expect(element.setAttribute).not.toHaveBeenCalled();
  });
  it("applies Bootstrap data-bs-theme for committed non-null values", () => {
    const element = { setAttribute: vi.fn(), removeAttribute: vi.fn() };
    expect(applyVisitorTheme(element, "system", true)).toBe("dark");
    expect(element.setAttribute).toHaveBeenCalledWith("data-bs-theme", "dark");
    expect(applyVisitorTheme(element, "system", false)).toBe("light");
    expect(element.setAttribute).toHaveBeenCalledWith("data-bs-theme", "light");
  });
  it("early bootstrap script only reads local theme without transmitting preferences", () => {
    expect(VISITOR_THEME_BOOTSTRAP_SCRIPT).toContain('localStorage.getItem("lmn24.visitorPreferences")');
    expect(VISITOR_THEME_BOOTSTRAP_SCRIPT).toContain('value.version !== 1');
    expect(VISITOR_THEME_BOOTSTRAP_SCRIPT).toContain('matchMedia("(prefers-color-scheme: dark)")');
    expect(VISITOR_THEME_BOOTSTRAP_SCRIPT).not.toContain("fetch(");
    expect(VISITOR_THEME_BOOTSTRAP_SCRIPT).not.toContain("birthDate");
    expect(VISITOR_THEME_BOOTSTRAP_SCRIPT).not.toContain("gtag");
  });
});
