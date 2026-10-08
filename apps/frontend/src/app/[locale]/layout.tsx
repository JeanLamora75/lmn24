import "bootstrap/dist/css/bootstrap.min.css";
import "../globals.css";

import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { PublicHeader } from "@/components/public/PublicHeader";
import { routing, type AppLocale } from "@/i18n/routing";

export const metadata: Metadata = {
  title: { default: "LMN24", template: "%s | LMN24" },
  description: "Agrégateur multilingue d'actualités internationales.",
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
      <body>
        <NextIntlClientProvider>
          <PublicHeader />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
