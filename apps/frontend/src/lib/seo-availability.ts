import { getBackendUrl } from "./admin-backend";
import { SEO_LANGUAGES, type SeoLocale } from "./seo-metadata";

type DynamicKind = "categories" | "sources";

/**
 * Only advertise alternate URLs when the active entity has content
 * in that language. Public API contains no private editorial fields.
 */
export async function getSeoAvailableLocales(
  kind: DynamicKind,
  slug: string,
): Promise<SeoLocale[] | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 255) return [];
  try {
    const response = await fetch(getBackendUrl() + "/public/seo/languages?" +
      new URLSearchParams({ kind, slug }), {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("locales" in payload) ||
      !Array.isArray(payload.locales)) return null;
    const locales = payload.locales.filter((value: unknown): value is SeoLocale =>
      typeof value === "string" && SEO_LANGUAGES.includes(value as SeoLocale));
    return SEO_LANGUAGES.filter(locale => locales.includes(locale));
  } catch {
    return null;
  }
}
