"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  VISITOR_PREFERENCES_KEY,
  defaultVisitorPreferences,
  parseVisitorPreferences,
  persistVisitorPreferences,
  readVisitorPreferences,
  resetVisitorPreference,
  type VisitorPreferences,
  type VisitorPreferencesField,
} from "@/lib/visitor-preferences";

export type PreferencesSaveState = "idle" | "invalid" | "unavailable" | "conflict";
export type VisitorPreferencesContextValue = {
  preferences: VisitorPreferences;
  draft: VisitorPreferences | null;
  ready: boolean;
  conflict: boolean;
  saveState: PreferencesSaveState;
  beginEdit: () => void;
  updateDraft: (next: VisitorPreferences | ((previous: VisitorPreferences) => VisitorPreferences)) => void;
  resetDraftField: (field: VisitorPreferencesField) => void;
  resetDraftAll: () => void;
  cancelEdit: () => void;
  saveDraft: () => boolean;
};

const PreferencesContext = createContext<VisitorPreferencesContextValue | null>(null);

export function VisitorPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(defaultVisitorPreferences);
  const [draft, setDraft] = useState<VisitorPreferences | null>(null);
  const [ready, setReady] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [saveState, setSaveState] = useState<PreferencesSaveState>("idle");

  useEffect(() => {
    // All reads are browser-only after hydration. Never serialize personal data into SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreferences(readVisitorPreferences(window.localStorage));
    setReady(true);
    const sync = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) return;
      if (event.key !== null && event.key !== VISITOR_PREFERENCES_KEY) return;
      let next = defaultVisitorPreferences();
      if (event.key === VISITOR_PREFERENCES_KEY && event.newValue !== null) {
        try { next = parseVisitorPreferences(JSON.parse(event.newValue)) ?? defaultVisitorPreferences(); }
        catch { /* Invalid external data is not trusted. */ }
      }
      setPreferences(next);
      setDraft((current) => {
        if (current !== null) setConflict(true);
        return current; // Never silently overwrite an open editor.
      });
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const beginEdit = useCallback(() => {
    setDraft({ ...preferences, city: preferences.city ? { ...preferences.city } : null });
    setConflict(false);
    setSaveState("idle");
  }, [preferences]);

  const updateDraft = useCallback((next: VisitorPreferences | ((previous: VisitorPreferences) => VisitorPreferences)) => {
    setDraft((previous) => previous === null ? previous :
      typeof next === "function" ? next(previous) : next);
    setSaveState("idle");
  }, []);

  const resetDraftField = useCallback((field: VisitorPreferencesField) => {
    setDraft((previous) => previous ? resetVisitorPreference(previous, field) : null);
    setSaveState("idle");
  }, []);

  const resetDraftAll = useCallback(() => {
    setDraft((previous) => previous === null ? null : defaultVisitorPreferences());
    setSaveState("idle");
  }, []);

  const cancelEdit = useCallback(() => {
    setDraft(null);
    setConflict(false);
    setSaveState("idle");
  }, []);

  const saveDraft = useCallback((): boolean => {
    if (draft === null) return false;
    if (conflict) { setSaveState("conflict"); return false; }
    const result = persistVisitorPreferences(window.localStorage, draft);
    if (!result.ok) {
      setSaveState(result.reason);
      return false; // No in-memory "saved" state when persistence failed.
    }
    setPreferences(result.value);
    setDraft(null);
    setConflict(false);
    setSaveState("idle");
    return true;
  }, [draft, conflict]);

  const value = useMemo(() => ({
    preferences, draft, ready, conflict, saveState,
    beginEdit, updateDraft, resetDraftField, resetDraftAll, cancelEdit, saveDraft,
  }), [preferences, draft, ready, conflict, saveState,
    beginEdit, updateDraft, resetDraftField, resetDraftAll, cancelEdit, saveDraft]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function useVisitorPreferences(): VisitorPreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("useVisitorPreferences requires VisitorPreferencesProvider");
  return context;
}
