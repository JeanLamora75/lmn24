"use client";

import { useEffect } from "react";
import { applyVisitorTheme } from "@/lib/visitor-theme";
import { useVisitorPreferences } from "./VisitorPreferencesProvider";

/**
 * Applies only committed preferences: changing radio buttons in the draft
 * does not alter the page until the visitor explicitly saves.
 */
export function PublicThemeController() {
  const { preferences, ready } = useVisitorPreferences();
  const theme = preferences.theme;

  useEffect(() => {
    if (!ready) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      applyVisitorTheme(document.documentElement, theme, media.matches);
    };
    update();
    if (theme !== "system") return;
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme, ready]);

  return null;
}
