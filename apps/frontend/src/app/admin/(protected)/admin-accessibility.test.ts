import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const shell = read("./AdminShell.tsx");
const layout = read("./admin-shell.module.css");
const styles = read("./admin-accessibility.css");

describe("lot 6 — accessible administration shell", () => {
  it("offers keyboard skip navigation and a focusable content destination", () => {
    expect(shell).toContain('href="#lmn24-admin-main"');
    expect(shell).toContain('id="lmn24-admin-main" tabIndex={-1}');
    expect(styles).toContain(".lmn-admin-skip-link:focus");
  });
  it("keeps the closed mobile navigation outside the keyboard focus order", () => {
    expect(layout).toContain(".sidebar{visibility:hidden;pointer-events:none}");
    expect(layout).toContain(".sidebar.mobileOpen{visibility:visible;pointer-events:auto}");
    expect(shell).toContain('aria-expanded={mobileOpen}');
    expect(shell).toContain('aria-label="Fermer la navigation"');
  });
  it("supports Escape, Tab trapping and restoring focus", () => {
    expect(shell).toContain('event.key === "Escape"');
    expect(shell).toContain('event.key !== "Tab"');
    expect(shell).toContain('last.focus()');
    expect(shell).toContain('first.focus()');
    expect(shell).toContain('toggleRef.current?.focus()');
    expect(shell).toContain('document.body.style.overflow = "hidden"');
  });
  it("preserves navigation names when icons only are visible", () => {
    expect(shell).toContain('aria-label={section.title}');
    expect(shell).toContain('aria-label={feature.title}');
    expect(shell).toContain('hidden={!expanded && (!collapsed || mobileOpen)}');
  });
  it("provides consistent visible focus, scrollable tables and reduced motion", () => {
    expect(styles).toContain(':focus-visible');
    expect(styles).toContain('.table-responsive');
    expect(styles).toContain("overflow-x:auto");
    expect(styles).toContain("@media(prefers-reduced-motion:reduce)");
  });
});
