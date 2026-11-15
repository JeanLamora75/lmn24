import "bootstrap/dist/css/bootstrap.min.css";
import "../globals.css";

import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { PublicFooter } from "@/components/public/PublicFooter";
import { StructuredData } from "@/components/seo/StructuredData";
import { siteSchema } from "@/lib/seo-schema";
import type { SeoLocale } from "@/lib/seo-metadata";
import { GoogleAnalyticsTracker } from "@/components/public/GoogleAnalyticsTracker";
import { PublicHeader } from "@/components/public/PublicHeader";
import { routing, type AppLocale } from "@/i18n/routing";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.lmn24.com"),
  title: { default: "LMN24", template: "%s | LMN24" },
  description: "Agrégateur multilingue d'actualités internationales.",
  icons: { icon: [{ url: "/logo_lmn24.png", type: "image/png", sizes: "192x192" }], shortcut: "/logo_lmn24.png", apple: "/logo_lmn24.png" },
};

export function generateStaticParams() {
  return routing.locales.map((locale: AppLocale) => ({ locale }));
}

type Props = Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>;

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body className="d-flex min-vh-100 flex-column">
        <StructuredData data={siteSchema(locale as SeoLocale)} />
        <NextIntlClientProvider>
          <PublicHeader />
          <div className="flex-grow-1">{children}</div>
          <PublicFooter />
          <GoogleAnalyticsTracker />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
