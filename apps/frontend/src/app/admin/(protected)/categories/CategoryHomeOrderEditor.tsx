"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";

import { getFrenchCategoryLabel } from "@/lib/fr-category-labels";

import {
  byHomeOrder,
  hasOrderChanged,
  moveCategory,
  moveCategoryBy,
  type CategoryItem,
} from "./category-home-order";
import styles from "./categories.module.css";

type Props = {
  categories: CategoryItem[];
  onSaved: (categories: CategoryItem[]) => void;
  onRefreshed: (categories: CategoryItem[]) => void;
  onCancel: () => void;
  onUnauthorized: () => void;
};

export function CategoryHomeOrderEditor({
  categories,
  onSaved,
  onRefreshed,
  onCancel,
  onUnauthorized,
}: Props) {
  const initial = byHomeOrder(categories);
  const [ordered, setOrdered] = useState(initial);
  const [expectedIds, setExpectedIds] = useState(
    initial.map((category) => category.id),
  );
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const savingRef = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const draggedId = useRef<string | null>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const changed = hasOrderChanged(ordered, expectedIds);
  const busy = saving || refreshing;

  function announceMove(category: CategoryItem, newList: CategoryItem[]) {
    const position = newList.findIndex((item) => item.id === category.id) + 1;
    setAnnouncement(
      getFrenchCategoryLabel(category.slug) +
        " : position " +
        position +
        " sur " +
        newList.length +
        ". Modification non enregistrée.",
    );
  }

  function moveByButton(category: CategoryItem, delta: -1 | 1) {
    if (busy) return;
    const next = moveCategoryBy(ordered, category.id, delta);
    setOrdered(next);
    announceMove(category, next);
    setError("");
  }

  function startDrag(event: DragEvent<HTMLLIElement>, id: string) {
    if (busy) {
      event.preventDefault();
      return;
    }
    draggedId.current = id;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  }

  function drop(event: DragEvent<HTMLLIElement>, targetId: string) {
    event.preventDefault();
    if (busy) return;
    const sourceId = draggedId.current;
    draggedId.current = null;
    if (!sourceId) return;

    const category = ordered.find((item) => item.id === sourceId);
    if (!category) return;

    const next = moveCategory(ordered, sourceId, targetId);
    setOrdered(next);
    announceMove(category, next);
    setError("");
  }

  async function save() {
    // Le verrou synchrone protège aussi contre les doubles clics avant le rerender.
    if (savingRef.current || busy || !changed) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    setConflict(false);

    try {
      const response = await fetch("/api/admin/categories/home-order", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          categoryIds: ordered.map((category) => category.id),
          expectedOrder: expectedIds,
        }),
      });

      if (response.status === 401) {
        onUnauthorized();
        return;
      }
      if (response.status === 409) {
        setConflict(true);
        setError(
          "Le classement a été modifié ailleurs. Rechargez le classement avant de réessayer.",
        );
        return;
      }
      if (!response.ok) {
        throw new Error("save-failed");
      }

      const payload = (await response.json()) as { items?: CategoryItem[] };
      if (!Array.isArray(payload.items)) throw new Error("invalid-response");
      onSaved(byHomeOrder(payload.items));
    } catch {
      setError(
        "Impossible d’enregistrer le classement. Aucun nouvel ordre n’a été confirmé. Réessayez.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function reloadLatest() {
    if (busy) return;
    setRefreshing(true);
    setError("");

    try {
      const response = await fetch("/api/admin/categories", {
        cache: "no-store",
      });
      if (response.status === 401) {
        onUnauthorized();
        return;
      }
      if (!response.ok) throw new Error("load-failed");

      const payload = (await response.json()) as { items?: CategoryItem[] };
      if (!Array.isArray(payload.items)) throw new Error("invalid-response");

      const latest = byHomeOrder(payload.items);
      setOrdered(latest);
      setExpectedIds(latest.map((item) => item.id));
      setConflict(false);
      setAnnouncement("Le dernier classement enregistré a été rechargé.");
      onRefreshed(latest);
    } catch {
      setError("Impossible de recharger le classement. Réessayez.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section
      aria-labelledby="category-home-order-title"
      className={"card mb-4 " + styles.organizer}
    >
      <div className="card-body">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-2">
          <div>
            <h2
              id="category-home-order-title"
              className="h4 mb-2"
              tabIndex={-1}
              ref={titleRef}
            >
              Organiser les catégories de l’accueil
            </h2>
            <p className="text-body-secondary mb-0">
              Déplacez les catégories en les faisant glisser ou utilisez les
              boutons Monter et Descendre. Toutes les catégories, même
              inactives, participent au classement.
            </p>
          </div>
          <span className="badge text-bg-secondary">
            {ordered.length} catégories
          </span>
        </div>

        {error && (
          <div className="alert alert-danger my-3" role="alert">
            {error}
            {conflict && (
              <button
                type="button"
                className="btn btn-outline-danger btn-sm ms-2"
                disabled={busy}
                onClick={() => void reloadLatest()}
              >
                Recharger le classement
              </button>
            )}
          </div>
        )}

        <p role="status" aria-live="polite" className="visually-hidden">
          {announcement}
        </p>

        <ol className={"list-group list-group-numbered my-3 " + styles.orderList}>
          {ordered.map((category, index) => {
            const label = getFrenchCategoryLabel(category.slug);
            return (
              <li
                className={"list-group-item d-flex align-items-center gap-2 " + styles.orderItem}
                draggable={!busy}
                key={category.id}
                onDragStart={(event) => startDrag(event, category.id)}
                onDragOver={(event) => {
                  if (!busy) event.preventDefault();
                }}
                onDrop={(event) => drop(event, category.id)}
                onDragEnd={() => {
                  draggedId.current = null;
                }}
                title="Glisser pour déplacer ou utiliser les boutons Monter et Descendre"
              >
                <span aria-hidden="true" className={styles.dragHandle}>
                  ⋮⋮
                </span>
                <div className="flex-grow-1 min-w-0">
                  <span className="fw-semibold">{label}</span>
                  <span className="ms-2 text-body-secondary small">
                    Position {index + 1}
                  </span>
                </div>
                <span
                  className={
                    "badge " +
                    (category.isActive
                      ? "text-bg-success"
                      : "text-bg-secondary")
                  }
                >
                  {category.isActive ? "Active" : "Inactive"}
                </span>
                <div
                  className="btn-group btn-group-sm"
                  role="group"
                  aria-label={"Déplacer " + label}
                >
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    aria-label={"Monter " + label}
                    title={"Monter " + label}
                    disabled={busy || index === 0}
                    onClick={() => moveByButton(category, -1)}
                  >
                    ↑ <span className="d-none d-sm-inline">Monter</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    aria-label={"Descendre " + label}
                    title={"Descendre " + label}
                    disabled={busy || index === ordered.length - 1}
                    onClick={() => moveByButton(category, 1)}
                  >
                    ↓ <span className="d-none d-sm-inline">Descendre</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="d-flex flex-wrap justify-content-end gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={busy}
            onClick={onCancel}
          >
            Annuler
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !changed}
            onClick={() => void save()}
          >
            {saving ? "Enregistrement…" : "Enregistrer l’ordre"}
          </button>
        </div>
      </div>
    </section>
  );
}
