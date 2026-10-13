/** Canonical comparison key shared by administration and future parser (SCRUM-51).
 * NFKC, lowercase, remove Latin diacritics and normalize whitespace.
 * Transliteration and semantic disambiguation intentionally excluded.
 */
export function normalizeHashtagTerm(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("und")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC").replace(/\s+/gu, " ").trim();
}
