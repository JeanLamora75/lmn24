/** SCRUM-76: clock per IANA timezone, independent from site language and device timezone.
 * Returns null for invalid zones, unusable instants or before browser hydration.
 */
export function formatCityLocalTime(
  now: Date | null,
  timezone: string,
  locale: string,
): string | null {
  if (!now || !Number.isFinite(now.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(now);
  } catch {
    return null;
  }
}
