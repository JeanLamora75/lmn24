"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import type { SupportedLocale } from "@lmn24/config";
import type { VisitorPreferences } from "@/lib/visitor-preferences";
import { CATEGORY_SETTINGS_COPY } from "./visitor-category-copy";
import styles from "./VisitorPreferencesDialog.module.css";
import { orderCategories, moveCategoryOrder } from "@/lib/category-personalization";

type Category = { id: string; slug: string; displayOrder: number };
type Props = {
  locale: SupportedLocale;
  categories: VisitorPreferences["categories"];
  onChange: (next: VisitorPreferences["categories"]) => void;
};
type Drag = { source: string; pointerId: number; target: string | null };

export function VisitorCategorySettings({ locale, categories, onChange }: Props) {
  const t = CATEGORY_SETTINGS_COPY[locale];
  const labels = useTranslations("categories");
  const [items, setItems] = useState<Category[]>([]);
  const [state, setState] = useState<"loading"|"ready"|"error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const dragRef = useRef<Drag | null>(null);

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

  const ordered = useMemo(() => orderCategories(items, categories.order), [items, categories.order]);

  const commitMove = (source: string, target: string) => {
    const ids = ordered.map(item => item.id);
    const next = moveCategoryOrder(ids, source, target);
    if (ids.every((id, i) => id === next[i])) return;
    // Preserve category IDs temporarily missing from the catalog.
    onChange({ ...categories, order: [
      ...next, ...categories.order.filter(id => !next.includes(id)),
    ] });
    const name = ordered.find(item => item.id === source);
    if (name) {
      const label = labels.has(name.slug) ? labels(name.slug) : name.slug.replaceAll("-", " ");
      setAnnouncement(t.moved.replace("{name}", label).replace("{position}", String(next.indexOf(source) + 1)));
    }
  };
  const cancelDrag = () => {
    dragRef.current = null;
    setDragging(null);
    setDropTarget(null);
  };
  const pointerDown = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (!event.isPrimary || event.button !== 0) return;
    dragRef.current = { source: id, pointerId: event.pointerId, target: null };
    setDragging(id);
    setDropTarget(null);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const row = hit?.closest<HTMLElement>("[data-visitor-category]");
    const target = row?.dataset.visitorCategory ?? null;
    drag.target = target && target !== drag.source ? target : null;
    setDropTarget(drag.target);
  };
  const pointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const target = drag.target;
    cancelDrag();
    if (target) commitMove(drag.source, target);
  };
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>, id: string, index: number) => {
    if (event.key === "ArrowUp" && index > 0) {
      event.preventDefault();
      const previous = ordered[index - 1];
      if (previous) commitMove(id, previous.id);
    } else if (event.key === "ArrowDown" && index < ordered.length - 1) {
      event.preventDefault();
      const next = ordered[index + 1];
      if (next) commitMove(id, next.id);
    } else if (event.key === "Escape" && dragRef.current) {
      event.preventDefault();
      event.stopPropagation();
      cancelDrag();
    }
  };
  const toggle = (id: string, shown: boolean) =>
    onChange({ ...categories, hidden: shown
      ? categories.hidden.filter(item => item !== id)
      : [...categories.hidden.filter(item => item !== id), id] });

  return <div className={styles.categorySettings}>
    <p className={styles.hint}>{t.help}</p>
    <p className={styles.hint}>{t.homeOnly}</p>
    <p className={styles.srOnly} id="category-drag-help">{t.dragHelp}</p>
    <p className={styles.srOnly} aria-live="polite" role="status">{announcement}</p>
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
        return <li key={item.id} data-visitor-category={item.id}
          className={[styles.categoryItem, dragging === item.id ? styles.categoryDragging : "",
            dropTarget === item.id ? styles.categoryDropTarget : ""].filter(Boolean).join(" ")}>
          <button type="button" className={styles.categoryHandle}
            aria-label={t.dragLabel.replace("{name}", name)}
            aria-describedby="category-drag-help"
            onPointerDown={event => pointerDown(event, item.id)}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={cancelDrag}
            onLostPointerCapture={cancelDrag}
            onKeyDown={event => keyDown(event, item.id, index)}>
            <svg viewBox="0 0 20 24" width="20" height="24" aria-hidden="true" fill="currentColor">
              <circle cx="6" cy="5" r="1.7"/><circle cx="14" cy="5" r="1.7"/>
              <circle cx="6" cy="12" r="1.7"/><circle cx="14" cy="12" r="1.7"/>
              <circle cx="6" cy="19" r="1.7"/><circle cx="14" cy="19" r="1.7"/>
            </svg>
          </button>
          <span className={[styles.categoryName, shown ? "" : styles.categoryHidden].filter(Boolean).join(" ")}>{name}</span>
          <label className={styles.categorySwitch}>
            <input type="checkbox" role="switch" checked={shown}
              onChange={event => toggle(item.id, event.target.checked)}
              aria-label={name} />
            <span className={styles.categorySwitchTrack} aria-hidden="true"/>
          </label>
        </li>;
      })}
    </ol>}
  </div>;
}
