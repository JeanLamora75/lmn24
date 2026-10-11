import { z } from "zod";

/**
 * Supplementary metadata for a news source.
 * URLs are informational, never fetched by LMN24.
 */
export const SOURCE_PROFILE_URL_FIELDS = [
  "rssPageUrl",
  "facebookUrl",
  "xUrl",
  "instagramUrl",
  "youtubeUrl",
] as const;

export type SourceProfileUrlField = (typeof SOURCE_PROFILE_URL_FIELDS)[number];

export const SOURCE_PROFILE_FIELDS = [
  ...SOURCE_PROFILE_URL_FIELDS,
  "description",
] as const;
export type SourceProfileField = (typeof SOURCE_PROFILE_FIELDS)[number];

const DOMAINS: Partial<Record<SourceProfileUrlField, readonly string[]>> = {
  facebookUrl: ["facebook.com", "fb.com"],
  xUrl: ["x.com", "twitter.com"],
  instagramUrl: ["instagram.com"],
  youtubeUrl: ["youtube.com"],
};

/** A real platform host, not 'facebook.com.attacker.example'. */
export function isValidSourceProfileUrl(
  value: string,
  field: SourceProfileUrlField,
): boolean {
  if (value.length > 2048 || value.length === 0) return false;
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      !url.hostname ||
      url.username ||
      url.password
    ) return false;
    const allowed = DOMAINS[field];
    if (!allowed) return true;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    return allowed.some(domain => host === domain || host.endsWith("." + domain));
  } catch {
    return false;
  }
}

function optionalSourceUrl(field: SourceProfileUrlField) {
  return z.union([z.string(), z.null()]).optional()
    .transform(value => value === undefined ? undefined : value?.trim() || null)
    .refine(
      value => value === null || value === undefined ||
        isValidSourceProfileUrl(value, field),
      { message: "Saisissez une URL HTTP(S) valide pour ce champ (2048 caractères maximum)." },
    );
}

export const sourceProfileSchema = z.object({
  rssPageUrl: optionalSourceUrl("rssPageUrl"),
  facebookUrl: optionalSourceUrl("facebookUrl"),
  xUrl: optionalSourceUrl("xUrl"),
  instagramUrl: optionalSourceUrl("instagramUrl"),
  youtubeUrl: optionalSourceUrl("youtubeUrl"),
  description: z.union([z.string(), z.null()]).optional()
    .transform(value => value === undefined ? undefined : value?.trim() || null)
    .refine(value => value === undefined || value === null || value.length <= 5000, {
      message: "La description ne peut pas dépasser 5 000 caractères.",
    }),
});

export type SourceProfile = z.output<typeof sourceProfileSchema>;
