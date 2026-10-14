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

/**
 * Six-item-ready navigation registry. Only entries with implemented public
 * routes belong in VISIBLE_NAVIGATION. To enable a future section, add a
 * route to this registry — the labels/icons and scrollable layout are ready.
 * Never show empty links or pretend a planned page already exists.
 */
type NavKey = "news" | "videos" | "hashtags" | "live" | "podcasts" | "dossiers";
const NAVIGATION_LABELS: Record<SupportedLocale, Record<NavKey, string>> = {
  fr: { news: "Articles", videos: "Vidéos", hashtags: "Hashtags", live: "Live", podcasts: "Podcasts", dossiers: "Dossiers" },
  en: { news: "Articles", videos: "Videos", hashtags: "Hashtags", live: "Live", podcasts: "Podcasts", dossiers: "Features" },
  de: { news: "Artikel", videos: "Videos", hashtags: "Hashtags", live: "Live", podcasts: "Podcasts", dossiers: "Dossiers" },
  es: { news: "Artículos", videos: "Vídeos", hashtags: "Hashtags", live: "Directo", podcasts: "Pódcasts", dossiers: "Reportajes" },
  pt: { news: "Artigos", videos: "Vídeos", hashtags: "Hashtags", live: "Ao vivo", podcasts: "Podcasts", dossiers: "Dossiês" },
  it: { news: "Articoli", videos: "Video", hashtags: "Hashtag", live: "Diretta", podcasts: "Podcast", dossiers: "Dossier" },
  ru: { news: "Статьи", videos: "Видео", hashtags: "Хэштеги", live: "Эфир", podcasts: "Подкасты", dossiers: "Материалы" },
  nl: { news: "Artikelen", videos: "Video's", hashtags: "Hashtags", live: "Live", podcasts: "Podcasts", dossiers: "Dossiers" },
};

// Add new links here only when their pages actually exist.
// With six entries, the large-screen navigation still fits and on smaller
// screens it scrolls horizontally, while logo/language remain visible.
const VISIBLE_NAVIGATION = [
  { key: "news", href: "/" },
  { key: "videos", href: "/videos" },
  { key: "hashtags", href: "/hashtags" },
] as const satisfies ReadonlyArray<{ key: NavKey; href: string }>;

function NavigationIcon({ name }: { name: NavKey }) {
  const common = {
    className: styles.navigationIcon,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.15,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    focusable: false as const,
  };
  switch (name) {
    case "news":
      return <svg {...common}><rect x="3" y="2.5" width="18" height="19" rx="2"/><rect x="6.5" y="6.5" width="5" height="5" rx=".4"/><path d="M15 7.5h3M15 10.5h3M7 15h11M7 18h11"/></svg>;
    case "videos":
      return <svg {...common}><rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none"/></svg>;
    case "hashtags":
      return <svg {...common}><path d="M9 3 6.5 21M17.5 3 15 21M4 9h16M3 15h16"/></svg>;
    case "live":
      return <svg {...common}><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/><path d="M7.2 7.2a6.8 6.8 0 0 0 0 9.6m9.6-9.6a6.8 6.8 0 0 1 0 9.6M4.3 4.3a10.9 10.9 0 0 0 0 15.4m15.4-15.4a10.9 10.9 0 0 1 0 15.4"/></svg>;
    case "podcasts":
      return <svg {...common}><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5.5 10v2a6.5 6.5 0 0 0 13 0v-2M12 18.5V22m-4 0h8"/></svg>;
    case "dossiers":
      return <svg {...common}><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3zM3 10h18"/></svg>;
  }
}

function isSupportedLocale(locale: string): locale is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

export function PublicHeader() {
  const detectedLocale = useLocale();
  const locale = isSupportedLocale(detectedLocale) ? detectedLocale : SUPPORTED_LOCALES[0];
  const tLanguages = useTranslations("languages");
  const navLabels = NAVIGATION_LABELS[locale];
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && dropdownRef.current &&
          !dropdownRef.current.contains(event.target)) {
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
    if (nextLocale !== locale) router.replace(pathname, { locale: nextLocale });
  };

  return (
    <header className={`sticky-top ${styles.header}`}>
      <div className={styles.headerLayout}>
        <div className={styles.brandPanel}>
          <Link href="/" className={styles.logoLink} aria-label="LMN24 — Accueil">
            <Image src="/logo_lmn24.png" width={86} height={86}
              alt="LMN24" className={styles.logo} unoptimized priority />
          </Link>
        </div>

        <nav className={styles.primaryNavigation} aria-label="Navigation principale">
          {VISIBLE_NAVIGATION.map((item) => {
            const isActive = item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.key} href={item.href}
                className={styles.navigationLink}
                aria-label={navLabels[item.key]}
                aria-current={isActive ? "page" : undefined}
                title={navLabels[item.key]}
                onClick={() => setIsOpen(false)}
              >
                <NavigationIcon name={item.key} />
                <span className={styles.navigationLabel}>{navLabels[item.key]}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.languagePanel}>
          <span className={styles.globeVisual} aria-hidden="true" />
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
              <Image src={LANGUAGE_FLAGS[locale]} width={32} height={32}
                alt="" aria-hidden="true" className={styles.currentFlag} unoptimized />
              <svg className={styles.chevron} width="16" height="16" viewBox="0 0 16 16"
                fill="none" stroke="currentColor" strokeWidth="2.3"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m3 6 5 5 5-5"/>
              </svg>
            </button>
            <ul id="public-language-menu"
              className={`dropdown-menu mt-2 ${styles.languageMenu} ${isOpen ? "show" : ""}`}
              role="menu"
            >
              {SUPPORTED_LOCALES.map((language) => (
                <li key={language} role="none">
                  <button type="button" role="menuitemradio"
                    aria-checked={language === locale} lang={language}
                    className={`dropdown-item d-flex align-items-center gap-2 ${language === locale ? "active" : ""}`}
                    onClick={() => changeLanguage(language)}
                  >
                    <Image src={LANGUAGE_FLAGS[language]} width={28} height={28}
                      alt="" aria-hidden="true" className={styles.flag} unoptimized />
                    <span>{tLanguages(language)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </header>
  );
}
