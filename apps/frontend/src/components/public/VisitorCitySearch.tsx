"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { SupportedLocale } from "@lmn24/config";
import { visitorCitySchema, type VisitorCity } from "@/lib/visitor-preferences";
import { CITY_SEARCH_COPY } from "./visitor-city-copy";
import styles from "./VisitorPreferencesDialog.module.css";

type Props = {
  country: string | null;
  locale: SupportedLocale;
  current: VisitorCity | null;
  onSelect: (city: VisitorCity) => void;
  onClear: () => void;
  clearLabel: string;
};

/** Only a chosen API suggestion is persisted; arbitrary text is never accepted as a city. */
export function VisitorCitySearch({ country, locale, current, onSelect, onClear, clearLabel }: Props) {
  const labels = CITY_SEARCH_COPY[locale];
  const id = useId();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [cities, setCities] = useState<VisitorCity[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "empty" | "error" | "limited">("idle");
  const [retryCount, setRetryCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const latestRequest = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (!country || term.length < 2) return;
    const controller = new AbortController();
    const requestId = ++latestRequest.current;
    const timeout = window.setTimeout(async () => {
      setState("loading");
      try {
        const params = new URLSearchParams({ country, name: term, locale });
        const response = await fetch("/api/public/visitor-cities?" + params.toString(), {
          signal: controller.signal,
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (controller.signal.aborted || latestRequest.current !== requestId) return;
        if (response.status === 429) {
          setState("limited"); setCities([]); return;
        }
        if (!response.ok) {
          setState("error"); setCities([]); return;
        }
        const payload: unknown = await response.json();
        if (controller.signal.aborted || latestRequest.current !== requestId) return;
        if (!payload || typeof payload !== "object" || !("cities" in payload) ||
            !Array.isArray(payload.cities)) throw new Error("bad-city-response");
        const valid = payload.cities
          .map((city: unknown) => visitorCitySchema.safeParse(city))
          .filter((result) => result.success)
          .map((result) => result.data)
          .filter((city) => city.countryIso2 === country);
        setCities(valid);
        setActiveIndex(-1);
        setState(valid.length ? "idle" : "empty");
      } catch {
        if (controller.signal.aborted || latestRequest.current !== requestId) return;
        setCities([]);
        setState("error");
      }
    }, 350);
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [country, query, locale, retryCount]);

  const updateQuery = (value: string) => {
    ++latestRequest.current; // Reject stale responses immediately, even before next effect.
    setQuery(value);
    setCities([]);
    setActiveIndex(-1);
    setState("idle");
  };
  const choose = (city: VisitorCity) => {
    ++latestRequest.current;
    setQuery("");
    setCities([]);
    setActiveIndex(-1);
    setState("idle");
    onSelect(city);
    inputRef.current?.focus();
  };

  const optionId = (index: number) => listId + "-option-" + index;
  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && cities.length > 0) {
      event.preventDefault();
      event.stopPropagation(); // Close suggestions, not the parent preferences dialog.
      setCities([]);
      setActiveIndex(-1);
      return;
    }
    if (cities.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((previous) => (previous + 1) % cities.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((previous) => previous <= 0 ? cities.length - 1 : previous - 1);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const candidate = cities[activeIndex];
      if (candidate) choose(candidate);
    }
  };

  return (
    <div className={styles.citySearch}>
      <label htmlFor={id} className={styles.fieldLabel}>{labels.search}</label>
      {current ? (
        <div className={styles.selectedCity}>
          <span>{labels.selected}: <strong>{[current.name, current.region, current.countryIso2].filter(Boolean).join(", ")}</strong></span>
          <button type="button" className={styles.reset} onClick={() => {
            onClear(); updateQuery("");
          }}>{clearLabel}</button>
        </div>
      ) : null}
      <input
        ref={inputRef}
        id={id}
        type="search"
        className="form-control"
        autoComplete="off"
        value={query}
        disabled={!country}
        placeholder={country ? labels.type : labels.selectCountry}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={cities.length > 0}
        aria-controls={cities.length > 0 ? listId : undefined}
        aria-activedescendant={activeIndex >= 0 && cities[activeIndex] ? optionId(activeIndex) : undefined}
        onKeyDown={onSearchKeyDown}
        onChange={(event) => updateQuery(event.target.value)}
      />
      {cities.length > 0 && <div id={listId} className={styles.cityResults} role="listbox" aria-label={labels.search}>
        {cities.map((city, index) => <button
          type="button" role="option" aria-selected={index === activeIndex}
          id={optionId(index)} tabIndex={-1}
          key={city.provider + ":" + city.providerId}
          className={styles.cityOption}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => choose(city)}
        >{[city.name, city.region, city.countryIso2].filter(Boolean).join(", ")}</button>)}
      </div>}
      <div aria-live="polite" className={styles.hint}>
        {!country ? labels.selectCountry :
          state === "loading" ? labels.loading :
          state === "empty" ? labels.empty :
          state === "limited" ? labels.rateLimited :
          state === "error" ? labels.unavailable :
          query.trim().length < 2 ? labels.type : ""}
      </div>
      {(state === "error" || state === "limited") && <button
        type="button" className={styles.reset}
        onClick={() => setRetryCount((currentCount) => currentCount + 1)}>
        {labels.retry}
      </button>}
    </div>
  );
}
