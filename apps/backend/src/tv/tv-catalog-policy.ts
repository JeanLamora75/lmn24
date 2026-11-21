/** SCRUM-115 / Mary D01-D03-D09-D10 — pure, deterministic TV catalogue rules.
 * No database access, no public routes; only safe for admin and future services.
 */
export type TvCountryChoice = { id: string; isoCode2: string; isActive: boolean };
export type TvVariantChoice = { id: string; channelId: string; code: string; isActive: boolean };
export type TvCountryAssociation = {
  channelId: string;
  countryId: string;
  isActive: boolean;
  needsReview: boolean;
  officialNumber: number | null;
  manualNumber: number | null;
  assignedNumber: number | null;
  defaultVariantId: string | null;
};

export function resolveTvCountry(
  countries: readonly TvCountryChoice[],
  preferredId?: string | null,
  localeCountryIso2?: string | null,
): TvCountryChoice | null {
  const active = countries.filter((country) => country.isActive);
  const preferred = active.find((country) => country.id === preferredId);
  if (preferred) return preferred;
  const locale = active.find(
    (country) => country.isoCode2.toUpperCase() === localeCountryIso2?.toUpperCase(),
  );
  if (locale) return locale;
  return [...active].sort((a, b) =>
    a.isoCode2.localeCompare(b.isoCode2, "en") || a.id.localeCompare(b.id),
  )[0] ?? null;
}

export function effectiveChannelNumber(
  association: Pick<TvCountryAssociation, "manualNumber" | "officialNumber" | "assignedNumber">,
): number | null {
  return association.manualNumber ?? association.officialNumber ?? association.assignedNumber;
}

export function nextAvailableNumber(used: ReadonlySet<number>, min = 1): number {
  if (!Number.isSafeInteger(min) || min < 1) throw new RangeError("Invalid channel number start");
  for (let candidate = min; candidate <= 2147483647; candidate++) {
    if (!used.has(candidate)) return candidate;
  }
  throw new RangeError("No free national channel number");
}

export function assertNumberAvailable(
  requested: number,
  others: readonly Pick<TvCountryAssociation, "manualNumber" | "officialNumber" | "assignedNumber">[],
): void {
  if (!Number.isSafeInteger(requested) || requested <= 0 || requested > 2147483647) {
    throw new RangeError("National channel number must be a positive int32");
  }
  if (others.some((item) => effectiveChannelNumber(item) === requested)) {
    throw new Error("National channel number already assigned for this country");
  }
}

export function defaultVariantForCountry(
  channelId: string,
  candidateVariantId: string | null,
  variantsForCountry: readonly TvVariantChoice[],
): TvVariantChoice | null {
  const eligible = variantsForCountry
    .filter((variant) => variant.isActive && variant.channelId === channelId)
    .sort((a, b) => a.code.localeCompare(b.code, "en") || a.id.localeCompare(b.id));
  return eligible.find((variant) => variant.id === candidateVariantId) ?? eligible[0] ?? null;
}

export function isTvAssociationPublic(
  countryActive: boolean,
  association: TvCountryAssociation,
): boolean {
  return countryActive && association.isActive && !association.needsReview
    && effectiveChannelNumber(association) !== null;
}

export function newDiscoveredAssociation(channelId: string, countryId: string): TvCountryAssociation {
  return {
    channelId, countryId, isActive: false, needsReview: true,
    officialNumber: null, manualNumber: null, assignedNumber: null, defaultVariantId: null,
  };
}

export function assertIanaZone(value: string): string {
  if (!value || value.length > 100 || !/^[A-Za-z0-9_+\-/]+$/.test(value)) {
    throw new Error("Invalid IANA timezone");
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(new Date(0));
  } catch {
    throw new Error("Unknown IANA timezone");
  }
  return value;
}

/** Display-only URLs: no automatic fetch. Network fetches require independent SSRF protection. */
export function assertOfficialUrl(raw: string | null): string | null {
  if (raw === null || raw.trim() === "") return null;
  if (raw.length > 2048) throw new Error("Official URL too long");
  const url = new URL(raw);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password
      || !url.hostname || /^(localhost|.+\.localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[?::1\]?)$/i.test(url.hostname)) {
    throw new Error("Invalid official website URL");
  }
  return url.href;
}

/** Only generated, immutable local icon files may be referenced as a local logo. */
export function assertTvLogoUrl(raw:string|null):string|null{
 if(raw===null||raw.trim()==="")return null;
 if(/^\/tv-icons\/[a-f0-9]{64}\.(png|jpg|webp)$/.test(raw))return raw;
 return assertOfficialUrl(raw);
}
