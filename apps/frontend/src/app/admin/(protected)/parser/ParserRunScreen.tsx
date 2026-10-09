"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { getFrenchCategoryLabel } from "@/lib/fr-category-labels";
import { FRENCH_COUNTRY_OPTIONS } from "@/lib/fr-country-options";

import styles from "./parser.module.css";

type CountryItem = {
  id: string;
  isoCode2: string;
};

type CategoryItem = {
  id: string;
  slug: string;
};

type LanguageItem = {
  isoCode2: string;
};

type FormOptionsResponse = {
  categories: CategoryItem[];
  languages: LanguageItem[];
};

type ParserEvent = {
  type:
    | "run-started"
    | "feed-started"
    | "feed-success"
    | "feed-error"
    | "run-completed"
    | "run-error";
  timestamp: string;
  message: string;
};

type UiMessage = {
  id: number;
  text: string;
  isError: boolean;
};

const INITIAL_MESSAGE = "Aucune extraction n’a encore été lancée.";

async function readErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const payload = (await response.json()) as {
      message?: string | string[];
    };

    if (Array.isArray(payload.message)) {
      return payload.message.join(" ");
    }

    return payload.message || fallback;
  } catch {
    return fallback;
  }
}

function timeLabel(timestamp: string): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ParserRunScreen() {
  const router = useRouter();
  const eventSourceRef = useRef<EventSource | null>(null);
  const messageSequence = useRef(0);

  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [languages, setLanguages] = useState<LanguageItem[]>([]);

  const [countryIsoCode2, setCountryIsoCode2] = useState("");
  const [languageIsoCode2, setLanguageIsoCode2] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([
    {
      id: 0,
      text: INITIAL_MESSAGE,
      isError: false,
    },
  ]);

  const countryLabelByCode = useMemo(
    () =>
      new Map(
        FRENCH_COUNTRY_OPTIONS.map((country) => [
          country.isoCode2.toUpperCase(),
          country.label,
        ]),
      ),
    [],
  );

  const sortedCountries = useMemo(
    () =>
      [...countries].sort((a, b) => {
        const aCode = a.isoCode2.trim().toUpperCase();
        const bCode = b.isoCode2.trim().toUpperCase();

        return (countryLabelByCode.get(aCode) ?? aCode).localeCompare(
          countryLabelByCode.get(bCode) ?? bCode,
          "fr",
          { sensitivity: "base" },
        );
      }),
    [countries, countryLabelByCode],
  );

  const sortedCategories = useMemo(
    () =>
      [...categories].sort((a, b) =>
        getFrenchCategoryLabel(a.slug).localeCompare(
          getFrenchCategoryLabel(b.slug),
          "fr",
          { sensitivity: "base" },
        ),
      ),
    [categories],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadOptions() {
      setLoading(true);

      try {
        const [countriesResponse, feedOptionsResponse] = await Promise.all([
          fetch("/api/admin/sources/form-countries", {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch("/api/admin/feeds/form-options", {
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);

        if (
          countriesResponse.status === 401 ||
          feedOptionsResponse.status === 401
        ) {
          router.replace("/admin/login");
          return;
        }

        if (!countriesResponse.ok || !feedOptionsResponse.ok) {
          throw new Error("load-options-failed");
        }

        const countriesPayload = (await countriesResponse.json()) as {
          items: CountryItem[];
        };
        const feedOptions =
          (await feedOptionsResponse.json()) as FormOptionsResponse;

        setCountries(countriesPayload.items);
        setCategories(feedOptions.categories);
        setLanguages(feedOptions.languages);
      } catch (caught) {
        if (
          !(caught instanceof DOMException && caught.name === "AbortError")
        ) {
          setMessages([
            {
              id: 1,
              text:
                "Impossible de charger les critères de lancement du parser.",
              isError: true,
            },
          ]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadOptions();

    return () => controller.abort();
  }, [router]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const appendEvent = (event: ParserEvent) => {
    messageSequence.current += 1;
    const prefix = timeLabel(event.timestamp);
    const text = prefix
      ? "[" + prefix + "] " + event.message
      : event.message;

    setMessages((current) => [
      ...current,
      {
        id: messageSequence.current,
        text,
        isError:
          event.type === "feed-error" || event.type === "run-error",
      },
    ]);
  };

  const launchParser = async () => {
    if (running) {
      return;
    }

    eventSourceRef.current?.close();
    setRunning(true);
    setMessages([]);

    const payload = {
      ...(countryIsoCode2
        ? { countryIsoCode2 }
        : {}),
      ...(languageIsoCode2
        ? { languageIsoCode2 }
        : {}),
      ...(categoryId ? { categoryId } : {}),
    };

    try {
      const response = await fetch("/api/admin/parser/runs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(
            response,
            "Le lancement du parser a échoué.",
          ),
        );
      }

      const result = (await response.json()) as {
        runId: string;
      };
      const eventSource = new EventSource(
        "/api/admin/parser/runs/" +
          encodeURIComponent(result.runId) +
          "/events",
      );

      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const payloadEvent = JSON.parse(event.data) as ParserEvent;
          appendEvent(payloadEvent);

          if (
            payloadEvent.type === "run-completed" ||
            payloadEvent.type === "run-error"
          ) {
            eventSource.close();
            eventSourceRef.current = null;
            setRunning(false);
          }
        } catch {
          // Ignore malformed event frames without interrupting the run.
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        eventSourceRef.current = null;
        setRunning(false);
        messageSequence.current += 1;
        setMessages((current) => [
          ...current,
          {
            id: messageSequence.current,
            text:
              "La connexion de suivi du parser a été interrompue.",
            isError: true,
          },
        ]);
      };
    } catch (error) {
      setRunning(false);
      messageSequence.current += 1;
      setMessages([
        {
          id: messageSequence.current,
          text:
            error instanceof Error
              ? error.message
              : "Le lancement du parser a échoué.",
          isError: true,
        },
      ]);
    }
  };

  return (
    <main className="container-fluid px-3 px-lg-4 py-4">
      <div className="mb-4">
        <Link href="/admin" className="btn btn-outline-secondary">
          Retour à l’administration
        </Link>
      </div>

      <header className="mb-4">
        <h1 className="h2 mb-1">Lancer le parser</h1>
        <p className="text-body-secondary mb-0">
          Lancez une extraction manuelle des flux RSS/XML actifs.
        </p>
      </header>

      <section
        className="card border-0 shadow-sm mb-4"
        aria-labelledby="parser-criteria-title"
      >
        <div className="card-body p-4">
          <h2 id="parser-criteria-title" className="h5 mb-3">
            Critères de lancement
          </h2>

          <div className="row g-3 align-items-end">
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label" htmlFor="parser-country">
                Pays
              </label>
              <select
                id="parser-country"
                className="form-select"
                value={countryIsoCode2}
                disabled={loading || running}
                onChange={(event) =>
                  setCountryIsoCode2(event.target.value)
                }
              >
                <option value="">Tous les pays</option>
                {sortedCountries.map((country) => {
                  const code = country.isoCode2.trim().toUpperCase();

                  return (
                    <option value={code} key={country.id}>
                      {countryLabelByCode.get(code) ?? code}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label" htmlFor="parser-language">
                Langue
              </label>
              <select
                id="parser-language"
                className="form-select"
                value={languageIsoCode2}
                disabled={loading || running}
                onChange={(event) =>
                  setLanguageIsoCode2(event.target.value)
                }
              >
                <option value="">Toutes les langues</option>
                {languages.map((language) => {
                  const code = language.isoCode2.trim().toLowerCase();

                  return (
                    <option value={code} key={code}>
                      {code.toUpperCase()}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label" htmlFor="parser-category">
                Catégorie
              </label>
              <select
                id="parser-category"
                className="form-select"
                value={categoryId}
                disabled={loading || running}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">Toutes les catégories</option>
                {sortedCategories.map((category) => (
                  <option value={category.id} key={category.id}>
                    {getFrenchCategoryLabel(category.slug)}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-6 col-xl-3 d-grid">
              <button
                type="button"
                className="btn btn-primary"
                disabled={loading || running}
                onClick={() => void launchParser()}
              >
                {running ? "Extraction en cours…" : "Lancer l’extraction"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section
        className={"card shadow-sm " + styles.informationPanel}
        aria-labelledby="parser-information-title"
      >
        <div className="card-body p-4">
          <h2 id="parser-information-title" className="h5 mb-3">
            Informations
          </h2>

          <div
            className={styles.messageLog}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {loading && messages.length === 1 ? (
              <p className="text-body-secondary mb-0">
                Chargement des critères disponibles…
              </p>
            ) : messages.length === 0 ? (
              <p className="text-body-secondary mb-0">
                Préparation de l’extraction…
              </p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={
                    "mb-2 " +
                    (message.isError
                      ? "text-danger"
                      : "text-body-secondary")
                  }
                >
                  {message.text}
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
