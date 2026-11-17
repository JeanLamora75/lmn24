import { z } from "zod";

/**
 * SCRUM-103 — Browser-only visitor preferences.
 * Never send this object to analytics, logs, cookies or the LMN24 backend.
 */
export const VISITOR_PREFERENCES_KEY = "lmn24.visitorPreferences";
export const VISITOR_PREFERENCES_VERSION = 1 as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || year < 1900 || !month || !day) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  const today = new Date();
  const currentUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day &&
    date.getTime() <= currentUTC;
});

export const visitorCitySchema = z.strictObject({
  provider: z.string().trim().min(1).max(64),
  providerId: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(200),
  region: z.string().trim().max(200).nullable(),
  countryIso2: z.string().regex(/^[A-Z]{2}$/),
  continent: z.enum(["EU", "AS", "AF", "NA", "SA", "OC"]),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  timezone: z.string().trim().min(1).max(128).nullable(),
});

const categoryIds = z.array(z.string().uuid()).max(100);
export const visitorCategorySettingsSchema = z.strictObject({
  order: categoryIds,
  hidden: categoryIds,
}).superRefine((value, ctx) => {
  if (new Set(value.order).size !== value.order.length || new Set(value.hidden).size !== value.hidden.length) {
    ctx.addIssue({ code: "custom", message: "Duplicate category identifiers." });
  }
});
export const defaultCategorySettings = () => ({ order: [] as string[], hidden: [] as string[] });

export const visitorPreferencesSchema = z.strictObject({
  version: z.literal(VISITOR_PREFERENCES_VERSION),
  theme: z.enum(["light", "dark", "system"]).nullable(),
  countryIso2: z.string().regex(/^[A-Z]{2}$/).nullable(),
  city: visitorCitySchema.nullable(),
  birthDate: isoDate.nullable(),
  categories: visitorCategorySettingsSchema.default(defaultCategorySettings),
}).superRefine((value, ctx) => {
  if (value.city && value.city.countryIso2 !== value.countryIso2) {
    ctx.addIssue({ code: "custom", path: ["city"], message: "City country does not match selected country." });
  }
});

export type VisitorPreferences = z.infer<typeof visitorPreferencesSchema>;
export type VisitorCity = z.infer<typeof visitorCitySchema>;
export type VisitorPreferencesField = "theme" | "countryIso2" | "city" | "birthDate" | "categories";

export function defaultVisitorPreferences(): VisitorPreferences {
  return { version: 1, theme: null, countryIso2: null, city: null, birthDate: null, categories: defaultCategorySettings() };
}

/** A pre-release/version-zero snapshot, if one exists, is upgraded to v1. */
function migrate(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const candidate = input as Record<string, unknown>;
  if (candidate.version !== 0) return input;
  // Explicit allowlist: obsolete and unknown keys never survive migration.
  const theme = candidate.theme === "auto" ? "system" : (candidate.theme ?? null);
  return {
    version: 1,
    theme,
    countryIso2: candidate.countryIso2 ?? null,
    city: candidate.city ?? null,
    birthDate: candidate.birthDate ?? null,
    categories: candidate.categories ?? defaultCategorySettings(),
  };
}

export function parseVisitorPreferences(raw: unknown): VisitorPreferences | null {
  const parsed = visitorPreferencesSchema.safeParse(migrate(raw));
  return parsed.success ? parsed.data : null;
}

export type PreferencesStorage = Pick<Storage, "getItem" | "setItem">;

export function readVisitorPreferences(storage: PreferencesStorage): VisitorPreferences {
  try {
    const raw = storage.getItem(VISITOR_PREFERENCES_KEY);
    if (raw === null) return defaultVisitorPreferences();
    return parseVisitorPreferences(JSON.parse(raw)) ?? defaultVisitorPreferences();
  } catch {
    // Disabled storage, invalid JSON, or privacy mode: normal public UI remains available.
    return defaultVisitorPreferences();
  }
}

export type SaveResult =
  | { ok: true; value: VisitorPreferences }
  | { ok: false; reason: "invalid" | "unavailable" };

export function persistVisitorPreferences(
  storage: PreferencesStorage,
  draft: unknown,
): SaveResult {
  const validated = parseVisitorPreferences(draft);
  if (!validated) return { ok: false, reason: "invalid" };
  try {
    storage.setItem(VISITOR_PREFERENCES_KEY, JSON.stringify(validated));
    return { ok: true, value: validated };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export function resetVisitorPreference(
  draft: VisitorPreferences,
  field: VisitorPreferencesField,
): VisitorPreferences {
  // Clearing a country also clears the now-invalid city, but never modifies storage.
  if (field === "countryIso2") return { ...draft, countryIso2: null, city: null };
  if (field === "categories") return { ...draft, categories: defaultCategorySettings() };
  return { ...draft, [field]: null };
}

export function changeVisitorCountry(
  draft: VisitorPreferences,
  countryIso2: string | null,
): VisitorPreferences {
  return {
    ...draft,
    countryIso2,
    city: draft.city?.countryIso2 === countryIso2 ? draft.city : null,
  };
}
