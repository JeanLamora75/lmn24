"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { changeVisitorCountry, parseVisitorPreferences } from "@/lib/visitor-preferences";
import { localizedCountries } from "@/lib/visitor-countries";
import { useVisitorPreferences } from "./VisitorPreferencesProvider";
import { PREFERENCES_FORM_COPY } from "./visitor-preferences-copy";
import { VisitorCitySearch } from "./VisitorCitySearch";
import { VisitorCategorySettings } from "./VisitorCategorySettings";
import { CATEGORY_SETTINGS_COPY } from "./visitor-category-copy";
import { zodiacSignFromBirthDate } from "@/lib/visitor-zodiac";
import { VISITOR_ZODIAC_PREVIEW } from "@/components/horoscope/visitor-zodiac-copy";
import type { SupportedLocale } from "@lmn24/config";
import styles from "./VisitorPreferencesDialog.module.css";

type Props = {
  open: boolean;
  locale: SupportedLocale;
  title: string;
  closeLabel: string;
  onClose: () => void;
  onSaved: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
};

/** SCRUM-105: all edits remain in-memory until Enregistrer is explicitly clicked. */
export function VisitorPreferencesDialog({
  open, locale, title, closeLabel, onClose, onSaved, returnFocusRef,
}: Props) {
  const t = PREFERENCES_FORM_COPY[locale];
  const tabs = CATEGORY_SETTINGS_COPY[locale];
  const titleId = useId();
  const descriptionId = useId();
  const generalTabId = useId();
  const categoriesTabId = useId();
  const generalPanelId = useId();
  const categoriesPanelId = useId();
  const [activeTab, setActiveTab] = useState<"general"|"categories">("general");
  const themeId = useId();
  const countryId = useId();
  const birthId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const generalTabRef = useRef<HTMLButtonElement>(null);
  const categoriesTabRef = useRef<HTMLButtonElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const { draft, preferences, ready, conflict, saveState, updateDraft,
    resetDraftField, resetDraftAll, cancelEdit, saveDraft } = useVisitorPreferences();
  const countries = useMemo(() => localizedCountries(locale), [locale]);
  const draftSign = zodiacSignFromBirthDate(draft?.birthDate);
  const zodiacCopy = VISITOR_ZODIAC_PREVIEW[locale] ?? VISITOR_ZODIAC_PREVIEW.fr!;

  // Preserve the current close and focus-restoration behavior from SCRUM-104.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, [open, returnFocusRef]);

  const cancel = () => {
    setConfirmReset(false);
    setActiveTab("general");
    cancelEdit();
    onClose();
  };
  const submit = () => {
    if (!ready || !draft || conflict) return;
    if (saveDraft()) {
      setConfirmReset(false);
      setActiveTab("general");
      onSaved();
    }
  };
  // Handle Escape even when focus is not inside the portal (e.g. native select
  // controls or mobile browsers). If autocomplete suggestions are open, leave
  // Escape to the city search so only the suggestions are dismissed first.
  useEffect(() => {
    if (!open) return;
    const onDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const target = event.target;
      if (target instanceof HTMLElement &&
          target.matches('[role="combobox"][aria-expanded="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
      cancelEdit();
      setConfirmReset(false);
      setActiveTab("general");
      onClose();
    };
    document.addEventListener("keydown", onDocumentKeyDown, true);
    return () => document.removeEventListener("keydown", onDocumentKeyDown, true);
  }, [open, cancelEdit, onClose]);

  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(preferences);
  const valid = draft !== null && parseVisitorPreferences(draft) !== null;
  const birthInvalid = !!draft?.birthDate && !parseVisitorPreferences({
    ...draft, countryIso2: null, city: null, birthDate: draft.birthDate,
  });
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      cancel();
      return;
    }
    if ((event.key === "ArrowRight" || event.key === "ArrowLeft" || event.key === "Home" || event.key === "End") &&
        (event.target === generalTabRef.current || event.target === categoriesTabRef.current)) {
      event.preventDefault();
      const next = event.key === "Home" ? "general" : event.key === "End" ? "categories" :
        activeTab === "general" ? "categories" : "general";
      setActiveTab(next);
      (next === "general" ? generalTabRef : categoriesTabRef).current?.focus();
      return;
    }
    if (event.key !== "Tab") return;
    const focusables = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? []).filter(element => !element.closest("[hidden]"));
    if (focusables.length === 0) { event.preventDefault(); return; }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus();
    }
  }

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className={styles.backdrop} onMouseDown={(event) => {
      if (event.target === event.currentTarget) cancel();
    }}>
      <div ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true"
        aria-labelledby={titleId} aria-describedby={descriptionId} onKeyDown={onKeyDown}>
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>{title}</h2>
          <button ref={closeRef} type="button" className={styles.close}
            onClick={cancel} aria-label={closeLabel} title={closeLabel}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" aria-hidden="true" focusable="false">
              <path d="M5 5l14 14M19 5 5 19" />
            </svg>
          </button>
        </div>
        <p id={descriptionId} className={styles.srOnly}>{tabs.general}. {tabs.categories}.</p>
        <div role="tablist" aria-label={title} className={styles.tabList}>
          <button ref={generalTabRef} type="button" role="tab" id={generalTabId}
            aria-selected={activeTab === "general"} aria-controls={generalPanelId}
            tabIndex={activeTab === "general" ? 0 : -1}
            className={styles.tabButton} onClick={() => setActiveTab("general")}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h16M4 17h16M8 4v6M16 14v6" />
            </svg><span>{tabs.general}</span>
          </button>
          <button ref={categoriesTabRef} type="button" role="tab" id={categoriesTabId}
            aria-selected={activeTab === "categories"} aria-controls={categoriesPanelId}
            tabIndex={activeTab === "categories" ? 0 : -1}
            className={styles.tabButton} onClick={() => setActiveTab("categories")}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5h3v3H4zM10 6h10M4 11h3v3H4zM10 12h10M4 17h3v3H4zM10 18h10" />
            </svg><span>{tabs.categories}</span>
          </button>
        </div>

        {draft ? (
          <div className={styles.form}>
            <div role="tabpanel" id={generalPanelId} aria-labelledby={generalTabId}
              hidden={activeTab !== "general"} className={styles.tabPanel}>
            <section className={styles.section} aria-labelledby={themeId}>
              <div className={styles.sectionHeading}>
                <h3 id={themeId}>{t.appearance}</h3>
                <button type="button" className={styles.reset}
                  onClick={() => resetDraftField("theme")}>{t.reset}</button>
              </div>
              <fieldset className={styles.themeChoices}>
                <legend className={styles.srOnly}>{t.theme}</legend>
                {([
                  ["system", t.automatic], ["light", t.light], ["dark", t.dark],
                ] as const).map(([value, label]) => (
                  <label key={value} className={styles.themeChoice}>
                    <input type="radio" name="visitor-theme" value={value}
                      checked={(draft.theme ?? "light") === value}
                      onChange={() => updateDraft((previous) => ({ ...previous, theme: value }))}/>
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>
            </section>

            <section className={styles.section} aria-labelledby={countryId + "-title"}>
              <div className={styles.sectionHeading}>
                <h3 id={countryId + "-title"}>{t.location}</h3>
                <button type="button" className={styles.reset}
                  onClick={() => resetDraftField("countryIso2")}>{t.reset}</button>
              </div>
              <label className={styles.fieldLabel} htmlFor={countryId}>{t.country}</label>
              <select id={countryId} className="form-select"
                value={draft.countryIso2 ?? ""}
                onChange={(event) => updateDraft((previous) =>
                  changeVisitorCountry(previous, event.target.value || null))}>
                <option value="">{t.chooseCountry}</option>
                {countries.map(({ code, name }) =>
                  <option key={code} value={code}>{name}</option>)}
              </select>
              <VisitorCitySearch
                key={draft.countryIso2 ?? "none"}
                country={draft.countryIso2}
                locale={locale}
                current={draft.city}
                clearLabel={t.reset}
                onClear={() => resetDraftField("city")}
                onSelect={(city) => updateDraft((previous) => previous.countryIso2 === city.countryIso2
                  ? { ...previous, city } : previous)}
              />
            </section>

            <section className={styles.section} aria-labelledby={birthId + "-title"}>
              <div className={styles.sectionHeading}>
                <h3 id={birthId + "-title"}>{t.birth}</h3>
                <button type="button" className={styles.reset}
                  onClick={() => resetDraftField("birthDate")}>{t.reset}</button>
              </div>
              <label className={styles.fieldLabel} htmlFor={birthId}>{t.birthDate}</label>
              <input id={birthId} type="date" className="form-control"
                min="1900-01-01" max={new Date().toISOString().slice(0, 10)}
                value={draft.birthDate ?? ""}
                aria-invalid={birthInvalid}
                onChange={(event) => updateDraft((previous) => ({
                  ...previous, birthDate: event.target.value || null,
                }))}/>
              <p className={styles.hint}>{t.birthHint}</p>
              {draftSign && <p className={styles.zodiacPreview} role="status">{zodiacCopy.heading} : <strong>{zodiacCopy.signs[draftSign]}</strong></p>}
              {birthInvalid && <p className={styles.error} role="alert">{t.dateError}</p>}
            </section>
            </div>
            <div role="tabpanel" id={categoriesPanelId} aria-labelledby={categoriesTabId}
              hidden={activeTab !== "categories"} className={styles.tabPanel}>
              {activeTab === "categories" && <section className={styles.section}>
                <div className={styles.sectionHeading}>
                  <h3>{tabs.categories}</h3>
                  <button type="button" className={styles.reset}
                    onClick={() => resetDraftField("categories")}>{t.reset}</button>
                </div>
                <VisitorCategorySettings locale={locale} categories={draft.categories}
                  onChange={(categories) => updateDraft(previous => ({ ...previous, categories }))}/>
              </section>}
            </div>
            <p className={styles.hint}>{t.privacy}</p>

            {saveState !== "idle" && (
              <p role="alert" className={styles.error}>{
                saveState === "unavailable" ? t.unavailable :
                saveState === "conflict" ? t.conflict : t.invalid
              }</p>
            )}
            {conflict && saveState === "idle" &&
              <p role="alert" className={styles.error}>{t.conflict}</p>}
            {dirty && <p className={styles.hint} role="status">{t.changed}</p>}

            {confirmReset && (
              <div className={styles.confirm} role="group" aria-label={t.resetConfirm}>
                <p className={styles.confirmTitle}>{t.resetConfirm}</p>
                <p className={styles.hint}>{t.resetWarning}</p>
                <div className={styles.confirmActions}>
                  <button type="button" className="btn btn-outline-secondary"
                    onClick={() => setConfirmReset(false)}>{t.cancel}</button>
                  <button type="button" className="btn btn-outline-danger"
                    onClick={() => { resetDraftAll(); setConfirmReset(false); }}>
                    {t.resetAll}
                  </button>
                </div>
              </div>
            )}

            <div className={styles.actions}>
              <button type="button" className={styles.resetAll}
                onClick={() => setConfirmReset(true)} disabled={confirmReset}>
                {t.resetAll}
              </button>
              <div className={styles.actionButtons}>
                <button type="button" className="btn btn-outline-secondary"
                  onClick={cancel}>{t.cancel}</button>
                <button type="button" className="btn btn-primary"
                  onClick={submit} disabled={!ready || !valid || conflict || confirmReset}>
                  {t.save}
                </button>
              </div>
            </div>
          </div>
        ) : <p className={styles.hint}>{t.privacy}</p>}
      </div>
    </div>,
    document.body,
  );
}
