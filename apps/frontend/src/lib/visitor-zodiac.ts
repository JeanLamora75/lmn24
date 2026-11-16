/**
 * SCRUM-109 — Conventional Western tropical zodiac, based on month/day only.
 * This is an entertainment-oriented date range, not an astronomical calculation.
 * Never transmit or log the supplied date of birth.
 */
export const WESTERN_ZODIAC_SIGNS = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
] as const;

export type WesternZodiacSign = (typeof WESTERN_ZODIAC_SIGNS)[number];

export function zodiacSignFromBirthDate(birthDate: string | null | undefined): WesternZodiacSign | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [year = NaN, month = NaN, day = NaN] = birthDate.split("-").map(Number);
  if (year < 1900 || month < 1 || month > 12 || day < 1) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month ||
      date.getUTCDate() !== day || date.getTime() > today) return null;

  // Month numbers 1..12; each month starts with the prior sign.
  const before: readonly WesternZodiacSign[] = [
    "capricorn", "aquarius", "pisces", "aries", "taurus", "gemini",
    "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius",
  ];
  const after: readonly WesternZodiacSign[] = [
    "aquarius", "pisces", "aries", "taurus", "gemini", "cancer",
    "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn",
  ];
  const firstDays = [20, 19, 21, 20, 21, 21, 23, 23, 23, 23, 22, 22];
  return (day >= (firstDays[month - 1] ?? Infinity) ? after[month - 1] : before[month - 1]) ?? null;
}
