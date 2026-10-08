"use client";

import { SUPPORTED_LOCALES, type SupportedLocale } from "@lmn24/config";
import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname, useRouter } from "@/i18n/navigation";

import styles from "./PublicFooter.module.css";

const CATEGORY_SLUGS = [
  "international",
  "national",
  "sports",
  "faits-divers",
  "technology",
  "economy",
  "politics",
  "cinema",
  "culture",
  "health",
  "education",
  "society",
  "music",
  "television",
  "radio",
] as const;

function isSupportedLocale(locale: string): locale is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

export function PublicFooter() {
  const detectedLocale = useLocale();
  const locale = isSupportedLocale(detectedLocale)
    ? detectedLocale
    : SUPPORTED_LOCALES[0];

  const tCategories = useTranslations("categories");
  const tLanguages = useTranslations("languages");
  const pathname = usePathname();
  const router = useRouter();

  const splitIndex = Math.ceil(CATEGORY_SLUGS.length / 2);
  const firstCategoryColumn = CATEGORY_SLUGS.slice(0, splitIndex);
  const secondCategoryColumn = CATEGORY_SLUGS.slice(splitIndex);

  const sortedLanguages = [...SUPPORTED_LOCALES].sort((a, b) =>
    tLanguages(a).localeCompare(tLanguages(b), locale, {
      sensitivity: "base",
    }),
  );

  const changeLanguage = (nextLocale: SupportedLocale) => {
    if (nextLocale === locale) {
      return;
    }

    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <footer className={`border-top bg-body-tertiary ${styles.footer}`}>
      <nav
        className="container py-4"
        aria-label="Navigation secondaire LMN24"
      >
        <div className="row g-4 d-none d-lg-flex">
          <div className="col-3">
            <ul className={styles.linkList}>
              <li>
                <Link href="/" className={styles.footerLink}>
                  LMN24
                </Link>
              </li>
            </ul>
          </div>

          <div className="col-3">
            <ul className={styles.linkList}>
              {firstCategoryColumn.map((category) => (
                <li key={category}>
                  <Link
                    href={`/category/${category}`}
                    className={styles.footerLink}
                  >
                    {tCategories(category)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-3">
            <ul className={styles.linkList}>
              {secondCategoryColumn.map((category) => (
                <li key={category}>
                  <Link
                    href={`/category/${category}`}
                    className={styles.footerLink}
                  >
                    {tCategories(category)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-3">
            <ul className={styles.linkList}>
              {sortedLanguages.map((language) => (
                <li key={language}>
                  <button
                    type="button"
                    className={`btn btn-link p-0 text-start ${styles.footerLink} ${styles.languageLink}`}
                    lang={language}
                    aria-current={language === locale ? "true" : undefined}
                    onClick={() => changeLanguage(language)}
                  >
                    {tLanguages(language)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </nav>

      <div className={`border-top text-center ${styles.copyright}`}>
        © {new Date().getFullYear()} LMN24
      </div>
    </footer>
  );
}
