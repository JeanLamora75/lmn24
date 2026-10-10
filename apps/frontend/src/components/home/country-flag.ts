/** Country of the publisher, never inferred from the article's language. */
export function countryFlagSrc(isoCode2: string | null | undefined): string | null {
  const code = isoCode2?.trim().toLowerCase();
  return code && /^[a-z]{2}$/.test(code)
    ? "/country-flags/w160/" + code + ".png"
    : null;
}

export function countryName(isoCode2: string, locale: string): string {
  const code = isoCode2.trim().toUpperCase();
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
