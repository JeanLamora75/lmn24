"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";

import styles from "./GoogleAnalyticsTracker.module.css";

export const GA4_MEASUREMENT_ID = "G-Z54C7T331W";
export const ANALYTICS_CONSENT_KEY = "lmn24.analytics.consent.v1";
export const OPEN_ANALYTICS_SETTINGS_EVENT = "lmn24:analytics-settings";
type Choice = "accepted" | "refused";
type Locale = "fr" | "en" | "de" | "es" | "pt" | "it" | "ru" | "nl";

const labels: Record<Locale, { title: string; explanation: string; accept: string; refuse: string; save: string }> = {
  fr: { title: "Mesure d’audience", explanation: "Avec votre accord, LMN24 utilise Google Analytics pour mesurer les visites et améliorer le site. Vous pouvez modifier votre choix à tout moment dans le pied de page.", accept: "Accepter", refuse: "Refuser", save: "Fermer" },
  en: { title: "Audience measurement", explanation: "With your consent, LMN24 uses Google Analytics to measure visits and improve the website. You can change your choice at any time in the footer.", accept: "Accept", refuse: "Decline", save: "Close" },
  de: { title: "Besucherstatistik", explanation: "Mit Ihrer Einwilligung nutzt LMN24 Google Analytics, um Besuche zu messen und die Website zu verbessern. Sie können Ihre Auswahl jederzeit in der Fußzeile ändern.", accept: "Akzeptieren", refuse: "Ablehnen", save: "Schließen" },
  es: { title: "Medición de audiencia", explanation: "Con tu consentimiento, LMN24 utiliza Google Analytics para medir las visitas y mejorar el sitio web. Puedes cambiar tu decisión en cualquier momento desde el pie de página.", accept: "Aceptar", refuse: "Rechazar", save: "Cerrar" },
  pt: { title: "Medição de audiência", explanation: "Com o seu consentimento, o LMN24 utiliza o Google Analytics para medir visitas e melhorar o site. Pode alterar a sua escolha a qualquer momento no rodapé.", accept: "Aceitar", refuse: "Recusar", save: "Fechar" },
  it: { title: "Misurazione del pubblico", explanation: "Con il tuo consenso, LMN24 utilizza Google Analytics per misurare le visite e migliorare il sito. Puoi modificare la tua scelta in qualsiasi momento nel piè di pagina.", accept: "Accetta", refuse: "Rifiuta", save: "Chiudi" },
  ru: { title: "Статистика посещений", explanation: "С вашего согласия LMN24 использует Google Analytics для оценки посещаемости и улучшения сайта. Вы можете изменить свой выбор в любое время в нижней части страницы.", accept: "Принять", refuse: "Отклонить", save: "Закрыть" },
  nl: { title: "Bezoekersstatistieken", explanation: "Met uw toestemming gebruikt LMN24 Google Analytics om bezoeken te meten en de website te verbeteren. U kunt uw keuze op elk moment wijzigen via de voettekst.", accept: "Accepteren", refuse: "Weigeren", save: "Sluiten" },
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function readConsent(): Choice | null {
  try {
    const stored = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return stored === "accepted" || stored === "refused" ? stored : null;
  } catch { return null; }
}

function clearAnalyticsCookies() {
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (!name || !/^_ga(?:_|$)/.test(name)) continue;
    const host = window.location.hostname;
    const domains = ["", "; domain=" + host, "; domain=." + host, "; domain=." + host.split(".").slice(-2).join(".")];
    for (const domain of domains) {
      document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + domain + "; SameSite=Lax";
    }
  }
}

function PageViewTracker({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      lastTracked.current = null;
      return;
    }
    const path = pathname + (search.toString() ? "?" + search.toString() : "");
    if (lastTracked.current === path) return;
    lastTracked.current = path;
    window.gtag?.("event", "page_view", {
      page_location: window.location.origin + path,
      page_path: path,
      page_title: document.title,
    });
  }, [enabled, pathname, search]);
  return null;
}

export function GoogleAnalyticsTracker() {
  const locale = useLocale();
  const text = labels[locale as Locale] ?? labels.fr;
  const [consent, setConsent] = useState<Choice | null>(null);
  const [ready, setReady] = useState(false);
  const [trackerReady, setTrackerReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    // Storage is browser-only; no Google script is requested before opt-in.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConsent(readConsent());
    setReady(true);
    const reopen = () => setShowSettings(true);
    window.addEventListener(OPEN_ANALYTICS_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(OPEN_ANALYTICS_SETTINGS_EVENT, reopen);
  }, []);

  useEffect(() => {
    if (!ready || consent !== "accepted") return;
    window.dataLayer ??= [];
    window.gtag ??= (...args: unknown[]) => { window.dataLayer?.push(args); };
    window.gtag("consent", "update", { analytics_storage: "granted" });
    window.gtag("js", new Date());
    // Page views are sent only by PageViewTracker, including client-side transitions.
    window.gtag("config", GA4_MEASUREMENT_ID, { send_page_view: false });
    if (!document.querySelector('script[data-lmn24-ga4="true"]')) {
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://www.googletagmanager.com/gtag/js?id=" + GA4_MEASUREMENT_ID;
      script.dataset.lmn24Ga4 = "true";
      document.head.appendChild(script);
      scriptRef.current = script;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTrackerReady(true);
  }, [ready, consent]);

  function choose(value: Choice) {
    try { window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value); }
    catch { /* Blocked storage: do not persist the decision. */ }
    if (value === "refused") {
      setTrackerReady(false);
      // No new analytics events are emitted after consent is withdrawn.
      window.gtag?.("consent", "update", { analytics_storage: "denied" });
      scriptRef.current?.remove();
      scriptRef.current = null;
      clearAnalyticsCookies();
    }
    setConsent(value);
    setShowSettings(false);
  }

  const visible = ready && (consent === null || showSettings);
  return (
    <>
      <Suspense fallback={null}><PageViewTracker enabled={ready && trackerReady && consent === "accepted"} /></Suspense>
      {visible ? (
        <section className={styles.banner} role="dialog" aria-modal="false" aria-label={text.title}>
          <div className={styles.content}>
            <div><strong>{text.title}</strong><p className="mb-0 mt-1">{text.explanation}</p></div>
            <div className={styles.actions}>
              <button type="button" className="btn btn-outline-secondary" onClick={() => choose("refused")}>{text.refuse}</button>
              <button type="button" className="btn btn-primary" onClick={() => choose("accepted")}>{text.accept}</button>
              {consent !== null ? <button type="button" className="btn btn-link" onClick={() => setShowSettings(false)}>{text.save}</button> : null}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
