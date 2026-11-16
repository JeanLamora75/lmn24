"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useVisitorPreferences } from "@/components/public/VisitorPreferencesProvider";
import { zodiacSignFromBirthDate, type WesternZodiacSign } from "@/lib/visitor-zodiac";
import styles from "./VisitorHoroscopeGrid.module.css";

export type HoroscopeSignEntry = {
  slug: WesternZodiacSign;
  symbol: string;
  dates: string;
  name: string;
};

const FAVORITE_LABEL: Record<string, string> = {
  fr: "Mon signe", en: "My sign", de: "Mein Sternzeichen", es: "Mi signo",
  pt: "O meu signo", it: "Il mio segno", ru: "Мой знак", nl: "Mijn sterrenbeeld",
};

export function VisitorHoroscopeGrid({
  locale, signs, choose,
}: {
  locale: string;
  signs: HoroscopeSignEntry[];
  choose: string;
}) {
  const { preferences, ready } = useVisitorPreferences();
  // Privacy: derive only in memory and never write to a cookie, URL, backend or analytics.
  const favorite = useMemo(
    () => ready ? zodiacSignFromBirthDate(preferences.birthDate) : null,
    [ready, preferences.birthDate],
  );
  const label = FAVORITE_LABEL[locale] ?? FAVORITE_LABEL.fr;

  return <div className="row row-cols-2 row-cols-md-3 row-cols-xl-4 g-3 g-lg-4">
    {signs.map(({ slug, symbol, dates, name }) => {
      const selected = favorite === slug;
      return <div className="col" key={slug}>
        <Link href={`/${locale}/horoscope/${slug}`}
          className={`card h-100 text-decoration-none text-body border shadow-sm text-center ${selected ? styles.favoriteSign : ""}`}
          data-favorite-sign={selected ? "true" : undefined}>
          <div className="card-body py-4 d-flex flex-column align-items-center">
            {selected && <span className={`badge mb-2 ${styles.favoriteBadge}`}>{label}</span>}
            <span className="display-4 text-primary" aria-hidden="true">{symbol}</span>
            <h2 className="h5 fw-semibold mt-3">{name}</h2>
            <p className="small text-body-secondary mb-3">{dates}</p>
            <span className="mt-auto text-primary small fw-semibold">{choose} →</span>
          </div>
        </Link>
      </div>;
    })}
  </div>;
}
