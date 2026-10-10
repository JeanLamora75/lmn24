"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import styles from "./feeds.module.css";

type Props = {
  feed: { id: string; feedUrl: string; sourceName: string };
  onClose: () => void;
  onDeleted: () => void;
};

export function FeedDeleteDialog({ feed, onClose, onDeleted }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const deletingRef = useRef(false);
  const [feedRuns, setFeedRuns] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadImpact() {
      try {
        const response = await fetch(
          "/api/admin/feeds/" + encodeURIComponent(feed.id) + "/delete-impact",
          { cache: "no-store", signal: controller.signal },
        );
        if (response.status === 401) {
          router.replace("/admin/login");
          return;
        }
        if (!response.ok) throw new Error("impact-unavailable");
        const data = (await response.json()) as { feedRuns: number };
        if (!Number.isSafeInteger(data.feedRuns) || data.feedRuns < 0) {
          throw new Error("invalid-impact");
        }
        setFeedRuns(data.feedRuns);
      } catch (caught) {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          setError("Impossible de calculer les historiques liés à ce flux. Suppression désactivée.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadImpact();
    return () => controller.abort();
  }, [feed.id, router]);

  async function confirmDelete() {
    if (deletingRef.current || loading || feedRuns === null) return;
    deletingRef.current = true;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(
        "/api/admin/feeds/" + encodeURIComponent(feed.id),
        { method: "DELETE", cache: "no-store" },
      );
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!response.ok) throw new Error("delete-failed");
      onDeleted();
    } catch {
      setError("Impossible de supprimer le flux. Aucune suppression n’est confirmée.");
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.deleteDialog}
      aria-labelledby="delete-feed-title"
      aria-describedby="delete-feed-description"
      onCancel={(event) => { if (deleting) event.preventDefault(); }}
      onClose={onClose}
    >
      <div className="p-4">
        <h2 id="delete-feed-title" className="h5 mb-3">
          Supprimer ce flux RSS/XML ?
        </h2>
        <p id="delete-feed-description" className="mb-2">
          Source : <strong>{feed.sourceName}</strong>
        </p>
        <p className={styles.dialogUrl}>{feed.feedUrl}</p>
        {loading ? (
          <p role="status">Vérification des historiques associés…</p>
        ) : feedRuns !== null ? (
          <div className="alert alert-warning">
            Cette suppression définitive effacera ce flux et{" "}
            <strong>{feedRuns} historique{feedRuns > 1 ? "s" : ""} d’exécution</strong>.
            Les articles déjà enregistrés seront conservés.
          </div>
        ) : null}
        {error && <p role="alert" className="alert alert-danger">{error}</p>}
        <div className="d-flex justify-content-end gap-2 mt-4">
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={deleting}
            onClick={() => dialogRef.current?.close()}
          >
            Annuler
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={loading || feedRuns === null || deleting}
            onClick={() => void confirmDelete()}
          >
            {deleting ? "Suppression…" : "Supprimer définitivement"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
