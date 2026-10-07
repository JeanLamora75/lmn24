import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en", "de", "es", "pt", "it", "ru"],
  defaultLocale: "fr",
  localePrefix: "always",
  localeDetection: true,
  localeCookie: {
    name: "LMN24_LOCALE",
  },
});

export type AppLocale = (typeof routing.locales)[number];
