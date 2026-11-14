"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

const PREFIX = "lmn24:admin-filters:v1:";

export function adminFilterStorageKey(section: string, field: string): string {
  return PREFIX + section + ":" + field;
}

/** Filter values only: no personal data, sessions, credentials or API payloads. */
export function readStoredFilter<T extends string | number | boolean>(
  raw: string | null,
  fallback: T,
): T {
  if (raw === null || raw.length > 2048) return fallback;
  try {
    const candidate: unknown = JSON.parse(raw);
    if (typeof candidate !== typeof fallback) return fallback;
    if (typeof candidate === "string" && candidate.length <= 512) return candidate as T;
    if (typeof candidate === "number" && Number.isInteger(candidate) && candidate >= 1 && candidate <= 100) return candidate as T;
    if (typeof candidate === "boolean") return candidate as T;
  } catch {
    // Tampered or old data must not interfere with a page.
  }
  return fallback;
}

export function clearAdminSessionFilters(): void {
  if (typeof window === "undefined") return;
  try {
    const storage = window.sessionStorage;
    for (let index = storage.length - 1; index >= 0; index--) {
      const key = storage.key(index);
      if (key?.startsWith(PREFIX)) storage.removeItem(key);
    }
  } catch {
    // Private browsing and disabled storage keep filters in React state only.
  }
}

export function useAdminSessionFilter<T extends string | number | boolean>(
  section: string,
  field: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial);
  const [restored, setRestored] = useState(false);
  const key = adminFilterStorageKey(section, field);

  useEffect(() => {
    try {
      const next = readStoredFilter(window.sessionStorage.getItem(key), initial);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(next);
    } catch {
      // Storage can be disabled; fall back to in-memory behavior.
    }
    setRestored(true);
    // initial is the initial value for this mounted view; changing the
    // persisted storage key is not supported during component lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!restored) return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage quota/permissions must never break administration.
    }
  }, [key, restored, value]);

  return [value, setValue];
}
