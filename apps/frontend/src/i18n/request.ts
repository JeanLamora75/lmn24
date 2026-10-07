import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";

import { routing, type AppLocale } from "./routing";

const messageLoaders: Record<
  AppLocale,
  () => Promise<{ default: Record<string, unknown> }>
> = {
  fr: () => import("../../../../messages/fr.json"),
  en: () => import("../../../../messages/en.json"),
  de: () => import("../../../../messages/de.json"),
  es: () => import("../../../../messages/es.json"),
  pt: () => import("../../../../messages/pt.json"),
  it: () => import("../../../../messages/it.json"),
  ru: () => import("../../../../messages/ru.json"),
};

export default getRequestConfig(async ({ requestLocale }) => {
  const requestedLocale = await requestLocale;

  if (!hasLocale(routing.locales, requestedLocale)) {
    notFound();
  }

  const locale = requestedLocale as AppLocale;
  const loader = messageLoaders[locale];

  if (!loader) {
    notFound();
  }

  const messages = (await loader()).default;

  return {
    locale,
    messages,
  };
});
