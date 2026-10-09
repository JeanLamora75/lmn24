"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
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

const INITIAL_MESSAGE = "Aucune extraction n’a encore été lancée.";

export function ParserRunScreen() {
  const router = useRouter();

  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [languages, setLanguages] = useState<LanguageItem[]>([]);

  const [countryIsoCode2, setCountryIsoCode2] = useState("");
  const [languageIsoCode2, setLanguageIsoCode2] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(INITIAL_MESSAGE);
  const [hasError, setHasError] = useState(false);

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
      setHasError(false);

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
        const feedOptions = (await feedOptionsResponse.json()) as FormOptionsResponse;

        setCountries(countriesPayload.items);
        setCategories(feedOptions.categories);
        setLanguages(feedOptions.languages);
      } catch (caught) {
        if (
          !(caught instanceof DOMException && caught.name === "AbortError")
        ) {
          setHasError(true);
          setMessage(
            "Impossible de charger les critères de lancement du parser.",
          );
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

  const selectedCountryLabel =
    countryLabelByCode.get(countryIsoCode2.toUpperCase()) ??
    countryIsoCode2.toUpperCase();

  const selectedCategory = categories.find(
    (category) => category.id === categoryId,
  );

  const launchInterface = () => {
    setHasError(false);

    const criteria = [
      countryIsoCode2
        ? "Pays : " + selectedCountryLabel
        : "Pays : non sélectionné",
      languageIsoCode2
        ? "Langue : " + languageIsoCode2.toUpperCase()
        : "Langue : non sélectionnée",
      selectedCategory
        ? "Catégorie : " + getFrenchCategoryLabel(selectedCategory.slug)
        : "Catégorie : non sélectionnée",
    ];

    setMessage(
      "Interface prête pour le lancement manuel. " +
        criteria.join(" · ") +
        ". Le raccordement au parser sera réalisé dans la User Story dédiée à son fonctionnement.",
    );
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
          Préparez les critères d’une extraction manuelle des flux RSS/XML.
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
                disabled={loading}
                onChange={(event) =>
                  setCountryIsoCode2(event.target.value)
                }
              >
                <option value="">Sélectionner un pays</option>
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
                disabled={loading}
                onChange={(event) =>
                  setLanguageIsoCode2(event.target.value)
                }
              >
                <option value="">Sélectionner une langue</option>
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
                disabled={loading}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">Sélectionner une catégorie</option>
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
                disabled={loading}
                onClick={launchInterface}
              >
                Lancer l’extraction
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
            className={
              "mb-0 " +
              (hasError ? "text-danger" : "text-body-secondary")
            }
            role={hasError ? "alert" : "status"}
            aria-live="polite"
            aria-atomic="true"
          >
            {loading
              ? "Chargement des critères disponibles…"
              : message}
          </div>
        </div>
      </section>
    </main>
  );
}
