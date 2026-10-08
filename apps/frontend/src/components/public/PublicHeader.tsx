"use client";

import { SUPPORTED_LOCALES, type SupportedLocale } from "@lmn24/config";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Link, usePathname, useRouter } from "@/i18n/navigation";

import styles from "./PublicHeader.module.css";

const LANGUAGE_FLAGS: Record<SupportedLocale, string> = {
  fr: "🇫🇷",
  en: "🇬🇧",
  de: "🇩🇪",
  es: "🇪🇸",
  pt: "🇵🇹",
  it: "🇮🇹",
  ru: "🇷🇺",
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
      className={`sticky-top bg-white border-bottom shadow-sm ${styles.header}`}
    >
      <div className="container-fluid d-flex align-items-center justify-content-between px-3 px-md-4">
        <Link href="/" className={styles.logoLink} aria-label="LMN24">
          <Image
            src="/logo_lmn24.png"
            width={64}
            height={64}
            alt="LMN24"
            className={styles.logo}
          />
        </Link>

        <div className="dropdown" ref={dropdownRef}>
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
            <span className={styles.currentFlag} aria-hidden="true">
              {LANGUAGE_FLAGS[locale]}
            </span>
          </button>

          <ul
            id="public-language-menu"
            className={`dropdown-menu dropdown-menu-end mt-2 ${styles.languageMenu} ${
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
                  <span className={styles.flag} aria-hidden="true">
                    {LANGUAGE_FLAGS[language]}
                  </span>
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
