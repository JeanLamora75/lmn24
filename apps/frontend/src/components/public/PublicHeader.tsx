"use client";

import { SUPPORTED_LOCALES, type SupportedLocale } from "@lmn24/config";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Link, usePathname, useRouter } from "@/i18n/navigation";

import styles from "./PublicHeader.module.css";

const LANGUAGE_FLAGS: Record<SupportedLocale, string> = {
  fr: "/flags/fr.png",
  en: "/flags/en.png",
  de: "/flags/de.png",
  es: "/flags/es.png",
  pt: "/flags/pt.png",
  it: "/flags/it.png",
  ru: "/flags/ru.png",
  nl: "/flags/nl.png",
};


// Names are displayed as tooltips on hover and keyboard focus.
// This also keeps the new navigation in the visitor's current language.
const NAVIGATION_LABELS: Record<SupportedLocale, { news: string; videos: string; hashtags: string }> = {
  fr: { news: "Actualités", videos: "Vidéos", hashtags: "Hashtags" },
  en: { news: "News", videos: "Videos", hashtags: "Hashtags" },
  de: { news: "Nachrichten", videos: "Videos", hashtags: "Hashtags" },
  es: { news: "Noticias", videos: "Vídeos", hashtags: "Hashtags" },
  pt: { news: "Notícias", videos: "Vídeos", hashtags: "Hashtags" },
  it: { news: "Notizie", videos: "Video", hashtags: "Hashtag" },
  ru: { news: "Новости", videos: "Видео", hashtags: "Хэштеги" },
  nl: { news: "Nieuws", videos: "Video's", hashtags: "Hashtags" },
};

function isSupportedLocale(locale: string): locale is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

export function PublicHeader() {
  const detectedLocale = useLocale();
  const locale = isSupportedLocale(detectedLocale)
    ? detectedLocale
    : SUPPORTED_LOCALES[0];

  const tLanguages = useTranslations("languages");
  const navLabels = NAVIGATION_LABELS[locale];
  const pathname = usePathname();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        toggleRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const changeLanguage = (nextLocale: SupportedLocale) => {
    setIsOpen(false);

    if (nextLocale === locale) {
      return;
    }

    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <header
      className={`sticky-top border-bottom shadow-sm ${styles.header}`}
    >
      <div className="container-fluid d-flex align-items-center justify-content-between ps-3 ps-md-4 pe-0">
        <Link href="/" className={styles.logoLink} aria-label="LMN24">
          <Image
            src="/logo_lmn24.png"
            width={64}
            height={64}
            alt="LMN24"
            className={styles.logo}
            unoptimized
            priority
          />
        </Link>

        <nav className={styles.primaryNavigation} aria-label="Navigation principale">
          <Link
            href="/"
            className={styles.navigationLink}
            aria-label={navLabels.news}
            aria-current={pathname === "/" ? "page" : undefined}
          >
            <svg
              className={styles.navigationIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <rect x="3" y="2.5" width="18" height="19" rx="2" />
              <rect x="6.5" y="6.5" width="5" height="5" rx=".4" />
              <path d="M15 7.5h3M15 10.5h3M7 15h11M7 18h11" />
            </svg>
            <span className={styles.navigationTooltip} aria-hidden="true">{navLabels.news}</span>
          </Link>
          <Link
            href="/videos"
            className={styles.navigationLink}
            aria-label={navLabels.videos}
            aria-current={pathname === "/videos" ? "page" : undefined}
          >
            <svg
              className={styles.navigationIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
              <path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none" />
            </svg>
            <span className={styles.navigationTooltip} aria-hidden="true">{navLabels.videos}</span>
          </Link>
          <Link
            href="/hashtags"
            className={styles.navigationLink}
            aria-label={navLabels.hashtags}
            aria-current={pathname === "/hashtags" || pathname.startsWith("/hashtags/") ? "page" : undefined}
          >
            <svg
              className={styles.navigationIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M9 3 6.5 21M17.5 3 15 21M4 9h16M3 15h16" />
            </svg>
            <span className={styles.navigationTooltip} aria-hidden="true">{navLabels.hashtags}</span>
          </Link>
        </nav>
        <div className={`dropdown ${styles.languageDropdown}`} ref={dropdownRef}>
          <button
            ref={toggleRef}
            type="button"
            className={`btn btn-light border-0 ${styles.languageButton}`}
            aria-haspopup="menu"
            aria-expanded={isOpen}
            aria-controls="public-language-menu"
            aria-label={tLanguages(locale)}
            title={tLanguages(locale)}
            onClick={() => setIsOpen((current) => !current)}
          >
            <Image
              src={LANGUAGE_FLAGS[locale]}
              width={32}
              height={32}
              alt=""
              aria-hidden="true"
              className={styles.currentFlag}
              unoptimized
            />
          </button>

          <ul
            id="public-language-menu"
            className={`dropdown-menu mt-2 ${styles.languageMenu} ${
              isOpen ? "show" : ""
            }`}
            role="menu"
          >
            {SUPPORTED_LOCALES.map((language) => (
              <li key={language} role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={language === locale}
                  lang={language}
                  className={`dropdown-item d-flex align-items-center gap-2 ${
                    language === locale ? "active" : ""
                  }`}
                  onClick={() => changeLanguage(language)}
                >
                  <Image
                    src={LANGUAGE_FLAGS[language]}
                    width={28}
                    height={28}
                    alt=""
                    aria-hidden="true"
                    className={styles.flag}
                    unoptimized
                  />
                  <span>{tLanguages(language)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </header>
  );
}
