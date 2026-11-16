import type { VisitorPreferences } from "./visitor-preferences";

export type VisitorTheme = VisitorPreferences["theme"];
export type ResolvedVisitorTheme = "light" | "dark";

/** No saved selection retains LMN24's existing (light) appearance. */
export function resolveVisitorTheme(theme: VisitorTheme, prefersDark: boolean): ResolvedVisitorTheme {
  if (theme === "dark") return "dark";
  if (theme === "system") return prefersDark ? "dark" : "light";
  return "light";
}

export function applyVisitorTheme(
  element: Pick<HTMLElement, "setAttribute" | "removeAttribute">,
  theme: VisitorTheme,
  prefersDark: boolean,
): ResolvedVisitorTheme {
  const resolved = resolveVisitorTheme(theme, prefersDark);
  // An absent preference removes our theme override and leaves Bootstrap's original default.
  if (theme === null) element.removeAttribute("data-bs-theme");
  else element.setAttribute("data-bs-theme", resolved);
  return resolved;
}

/**
 * Executed in <head> before public content is painted.
 * Only a validated theme enum is ever read; the user's other preferences (including
 * birthDate) are not accessed here, and no data is sent to a server.
 * Keep this script consistent with resolveVisitorTheme and the v1 storage schema.
 */
export const VISITOR_THEME_BOOTSTRAP_SCRIPT = `(function () {
  try {
    var raw = localStorage.getItem("lmn24.visitorPreferences");
    if (!raw) return;
    var value = JSON.parse(raw);
    if (!value || value.version !== 1) return;
    var theme = value.theme;
    if (theme !== "light" && theme !== "dark" && theme !== "system") return;
    var dark = theme === "dark" || (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-bs-theme", dark ? "dark" : "light");
  } catch (_) {
    // Storage can be blocked. The existing light theme remains fully functional.
  }
})();`;
