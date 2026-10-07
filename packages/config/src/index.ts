export const SUPPORTED_LOCALES = [
  "fr",
  "en",
  "de",
  "es",
  "pt",
  "it",
  "ru",
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Technical bootstrap fallback only.
 * The runtime default language remains configurable through Setting.
 */
export const BOOTSTRAP_DEFAULT_LOCALE: SupportedLocale = "fr";

export const LOCALE_COOKIE_NAME = "LMN24_LOCALE";

export const DEFAULT_PORTS = {
  frontend: 3000,
  backend: 3001,
  parser: 3002,
  postgres: 5432,
} as const;

export const SERVICE_NAMES = {
  frontend: "frontend",
  backend: "backend",
  parser: "parser",
} as const;
