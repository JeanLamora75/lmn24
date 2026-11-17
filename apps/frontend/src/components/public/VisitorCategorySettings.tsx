"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { SupportedLocale } from "@lmn24/config";
import type { VisitorPreferences } from "@/lib/visitor-preferences";
import { CATEGORY_SETTINGS_COPY } from "./visitor-category-copy";
import styles from "./VisitorPreferencesDialog.module.css";

type Category = { id: string; slug: string; displayOrder: number };
type Props = {
  locale: SupportedLocale;
  categories: VisitorPreferences["categories"];
  onChange: (next: VisitorPreferences["categories"]) => void;
};

export function arrangeCategoryCatalog(items: readonly Category[], order: readonly string[]): Category[] {
  const positions = new Map(order.map((id, i) => [id, i]));
  return [...items].sort((a, b) => {
    const left = positions.get(a.id), right = positions.get(b.id);
    if (left !== undefined && right !== undefined) return left - right;
    if (left !== undefined) return -1;
    if (right !== undefined) return 1;
    return a.displayOrder - b.displayOrder || a.slug.localeCompare(b.slug);
  });
}

/** The catalog is public. Only a local draft is changed until the existing Save button is clicked. */
export function VisitorCategorySettings({ locale, categories, onChange }: Props) {
  const t = CATEGORY_SETTINGS_COPY[locale];
  const labels = useTranslations("categories");
  const [items, setItems] = useState<Category[]>([]);
  const [state, setState] = useState<"loading"|"ready"|"error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/public/visitor-category-catalog", { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("catalog-unavailable");
        const result: unknown = await response.json();
        if (!result || typeof result !== "object" || !("items" in result) || !Array.isArray(result.items)) {
          throw new Error("invalid-catalog");
        }
        const valid = result.items.filter((item: unknown): item is Category =>
          !!item && typeof item === "object" &&
          "id" in item && typeof item.id === "string" &&
          "slug" in item && typeof item.slug === "string" &&
          "displayOrder" in item && typeof item.displayOrder === "number");
        if (!controller.signal.aborted) { setItems(valid); setState("ready"); }
      })
      .catch(() => { if (!controller.signal.aborted) setState("error"); });
    return () => controller.abort();
  }, [attempt]);

  const ordered = useMemo(() => arrangeCategoryCatalog(items, categories.order), [items, categories.order]);
  const move = (id: string, delta: number) => {
    const ids = ordered.map(item => item.id);
    const index = ids.indexOf(id);
    const nextIndex = index + delta;
    if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return;
    const current = ids[index]!;
    ids[index] = ids[nextIndex]!;
    ids[nextIndex] = current;
    onChange({ ...categories, order: ids });
  };
  const toggle = (id: string, shown: boolean) =>
    onChange({ ...categories, hidden: shown
      ? categories.hidden.filter(item => item !== id)
      : [...categories.hidden.filter(item => item !== id), id] });

  return <div className={styles.categorySettings}>
    <p className={styles.hint}>{t.help}</p>
    <p className={styles.hint}>{t.homeOnly}</p>
    {state === "loading" && <p role="status">{t.load}</p>}
    {state === "error" && <div role="alert" className={styles.error}>
      {t.error} <button type="button" className="btn btn-outline-secondary btn-sm ms-2"
        onClick={() => { setState("loading"); setAttempt(value => value + 1); }}>{t.retry}</button>
    </div>}
    {state === "ready" && ordered.length === 0 && <p role="status">{t.empty}</p>}
    {state === "ready" && ordered.length > 0 && <ol className={styles.categoryList}>
      {ordered.map((item, index) => {
        const shown = !categories.hidden.includes(item.id);
        const name = labels.has(item.slug) ? labels(item.slug) : item.slug.replaceAll("-", " ");
        return <li key={item.id} className={styles.categoryItem}>
          <label className={styles.categoryToggle}>
            <input type="checkbox" checked={shown} onChange={event => toggle(item.id, event.target.checked)}
              aria-label={name + " — " + (shown ? t.show : t.hide)} />
            <span className={shown ? "" : styles.categoryHidden}>{name}</span>
          </label>
          <div className={styles.categoryMove}>
            <button type="button" disabled={index === 0} onClick={() => move(item.id, -1)}
              aria-label={t.up + " : " + name} title={t.up}>↑</button>
            <button type="button" disabled={index === ordered.length - 1} onClick={() => move(item.id, 1)}
              aria-label={t.down + " : " + name} title={t.down}>↓</button>
          </div>
        </li>;
      })}
    </ol>}
  </div>;
}
